import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import * as XLSX from 'xlsx';

// GET /api/analytics/export?month=YYYY-MM&lang=cs|en&format=csv|xlsx
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase, departments, isAdmin } = resolved;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const lang = (searchParams.get('lang') ?? 'cs') as 'cs' | 'en';
  const format = (searchParams.get('format') ?? 'csv') as 'csv' | 'xlsx';
  const allowedEmpIds = searchParams.get('employees')
    ? new Set(searchParams.get('employees')!.split(',').filter(Boolean))
    : null;
  const allowedCols = searchParams.get('cols')
    ? new Set(searchParams.get('cols')!.split(',').filter(Boolean))
    : null;
  const col = (key: string) => !allowedCols || allowedCols.has(key);

  const [year, mon] = month.split('-').map(Number);
  const dateFrom = `${month}-01`;
  const dateTo = new Date(year, mon, 0).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Load bonus settings from extra_settings JSONB
  const { data: settingsRow } = await sb
    .from('company_settings')
    .select('extra_settings')
    .eq('organization_id', orgId)
    .maybeSingle();

  const extra: Record<string, unknown> = (settingsRow?.extra_settings ?? {}) as Record<string, unknown>;
  const saturdayBonusPct: number = typeof extra['bonus_saturday_pct'] === 'number' ? extra['bonus_saturday_pct'] : Number(extra['bonus_saturday_pct'] ?? 0);
  const overtimeThreshold: number = typeof extra['bonus_overtime_threshold'] === 'number' ? extra['bonus_overtime_threshold'] : Number(extra['bonus_overtime_threshold'] ?? 0);
  const overtimeBonusPct: number = typeof extra['bonus_overtime_pct'] === 'number' ? extra['bonus_overtime_pct'] : Number(extra['bonus_overtime_pct'] ?? 0);
  const satBonusDepts: string[] = Array.isArray(extra['bonus_saturday_departments']) ? (extra['bonus_saturday_departments'] as string[]) : [];

  // Benefit definitions from extra_settings
  const BENEFIT_DEFS = [
    { key: 'blood',   czLabel: 'Darování krve',  enLabel: 'Blood donation',  hoursKey: 'benefit_blood_hours' },
    { key: 'english', czLabel: 'Angličtina',      enLabel: 'English lessons', hoursKey: 'benefit_english_hours' },
    { key: 'gym',     czLabel: 'Cvičení',         enLabel: 'Gym',             hoursKey: 'benefit_gym_hours' },
  ];
  const activeBenefits = BENEFIT_DEFS.filter((b) => extra[b.hoursKey] != null).map((b) => ({
    ...b,
    hoursPerUnit: Number(extra[b.hoursKey]),
  }));

  // hourly_rate only fetched when admin and column selected
  const includeRate = isAdmin && col('hourlyRate');
  let empQuery = sb.from('employees')
    .select(`id, name, department, target_hours, employment_type, vacation_days_per_year${includeRate ? ', hourly_rate' : ''}`)
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('name');
  if (departments && departments.length > 0) empQuery = empQuery.in('department', departments);

  const [empRes, logsRes, plansRes, vacRes, benefitLogsRes, bonusRes] = await Promise.all([
    empQuery,
    sb.from('attendance_logs').select('employee_id, check_in, check_out, date, work_type_name').eq('organization_id', orgId).gte('date', dateFrom).lte('date', dateTo),
    sb.from('work_plans').select('employee_id, date, start_time, end_time').eq('organization_id', orgId).eq('active', true).gte('date', dateFrom).lte('date', dateTo),
    sb.from('requests').select('employee_id, date_from, date_to').eq('organization_id', orgId).eq('type', 'vacation').eq('status', 'approved'),
    activeBenefits.length > 0
      ? sb.from('employee_benefit_logs').select('employee_id, benefit_key, count').eq('organization_id', orgId).eq('month', month)
      : Promise.resolve({ data: [] }),
    sb.from('employee_bonuses').select('employee_id, amount').eq('organization_id', orgId).eq('month', month),
  ]);

  const employees: { id: string; name: string; department: string | null; target_hours: number; employment_type?: string; vacation_days_per_year?: number; hourly_rate?: number | null }[] = empRes.data ?? [];
  const logs: { employee_id: string; check_in: string; check_out: string; date: string; work_type_name?: string | null }[] = logsRes.data ?? [];
  const plans: { employee_id: string; date: string; start_time: string | null; end_time: string | null }[] = plansRes.data ?? [];
  const vacReqs: { employee_id: string; date_from: string; date_to: string | null }[] = vacRes.data ?? [];
  const benefitLogs: { employee_id: string; benefit_key: string; count: number }[] = benefitLogsRes.data ?? [];
  // Manager-granted monthly bonuses (CZK) — multiple entries per employee are summed;
  // table may not exist yet, then the map stays empty
  const managerBonusMap = new Map<string, number>();
  for (const b of (bonusRes?.data ?? []) as { employee_id: string; amount: number }[]) {
    managerBonusMap.set(b.employee_id, (managerBonusMap.get(b.employee_id) ?? 0) + (Number(b.amount) || 0));
  }

  function isSat(dateStr: string) { return new Date(dateStr + 'T00:00:00').getDay() === 6; }

  const countWeekends = (extra['vacation_counting_mode'] as string | undefined) === 'all';

  function countVacHoursInMonth(empId: string): number {
    let days = 0;
    for (const r of vacReqs) {
      if (r.employee_id !== empId) continue;
      const from = new Date(r.date_from + 'T00:00:00');
      const to = r.date_to ? new Date(r.date_to + 'T00:00:00') : from;
      const cur = new Date(from);
      while (cur <= to) {
        const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        if (iso >= dateFrom && iso <= dateTo) {
          const dow = cur.getDay();
          if (countWeekends || (dow !== 0 && dow !== 6)) days++;
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    return days * 8;
  }

  const filteredEmployees = allowedEmpIds
    ? employees.filter((e) => allowedEmpIds.has(e.id))
    : employees;

  const LEGACY: Record<string, string> = { hpp: 'HPP', dpp: 'DPP', dpc: 'DPČ', ico: 'IČO' };

  const rows = filteredEmployees.map((emp) => {
    const empLogs = logs.filter((l) => l.employee_id === emp.id && l.check_in && l.check_out);
    const hasAttendance = empLogs.length > 0;

    const empDept = emp.department ?? '';
    let workedMinutes = 0;
    let saturdayMinutes = 0;
    let satBonusMinutes = 0;
    for (const l of empLogs) {
      const mins = Math.round((new Date(l.check_out).getTime() - new Date(l.check_in).getTime()) / 60000);
      workedMinutes += mins;
      if (isSat(l.date)) {
        saturdayMinutes += mins;
        if (saturdayBonusPct > 0) {
          const logType = l.work_type_name ?? '';
          const eligible = satBonusDepts.length === 0
            || satBonusDepts.includes(empDept)
            || satBonusDepts.includes(logType);
          if (eligible) satBonusMinutes += mins;
        }
      }
    }

    const workedHours = workedMinutes / 60;
    const saturdayHours = saturdayMinutes / 60;
    const satBonusHours = satBonusMinutes / 60 * (saturdayBonusPct / 100);
    let otBonusHours = 0;
    if (overtimeThreshold > 0 && workedHours > overtimeThreshold) {
      otBonusHours = (workedHours - overtimeThreshold) * (overtimeBonusPct / 100);
    }
    const targetHours = emp.target_hours ?? 160;

    const empBenefitLogs = benefitLogs.filter((bl) => bl.employee_id === emp.id);
    const benefitHours: Record<string, number> = {};
    let totalBenefitHours = 0;
    for (const b of activeBenefits) {
      const log = empBenefitLogs.find((bl) => bl.benefit_key === b.key);
      const h = log ? Math.round(log.count * b.hoursPerUnit * 100) / 100 : 0;
      benefitHours[b.key] = h;
      totalBenefitHours += h;
    }
    totalBenefitHours = Math.round(totalBenefitHours * 100) / 100;

    const totalBonusHours = Math.round((satBonusHours + otBonusHours + totalBenefitHours) * 100) / 100;
    // Benefit hours carry their own sign (blood +8/unit, gym/english −1/unit),
    // so everything is ADDED — subtracting a negative would double-count.
    const finalHours = Math.round((
      workedHours + satBonusHours + otBonusHours
      + (benefitHours['blood'] ?? 0)
      + (benefitHours['gym'] ?? 0)
      + (benefitHours['english'] ?? 0)
    ) * 100) / 100;

    const managerBonus = managerBonusMap.get(emp.id) ?? 0;
    const hourlyRate = includeRate ? (emp.hourly_rate ?? null) : null;
    // Payroll total = final hours × rate + manager bonus (CZK)
    const billableTotal = hourlyRate != null
      ? Math.round((finalHours * hourlyRate + managerBonus) * 100) / 100
      : null;

    return {
      name: emp.name,
      employmentType: LEGACY[emp.employment_type ?? ''] ?? (emp.employment_type ?? ''),
      source: hasAttendance ? (lang === 'en' ? 'attendance' : 'docházka') : (lang === 'en' ? 'no data' : 'bez dat'),
      workedHours: Math.round(workedHours * 100) / 100,
      saturdayHours: Math.round(saturdayHours * 100) / 100,
      satBonusHours: Math.round(satBonusHours * 100) / 100,
      otBonusHours: Math.round(otBonusHours * 100) / 100,
      benefitHours,
      totalBenefitHours,
      totalBonusHours,
      finalHours,
      targetHours,
      delta: Math.round((workedHours - targetHours) * 100) / 100,
      vacHours: countVacHoursInMonth(emp.id),
      managerBonus,
      hourlyRate,
      billableTotal,
    };
  });

  const isEn = lang === 'en';
  const includeBenefits = col('benefits') && activeBenefits.length > 0;

  // ── Build header/row arrays (shared for CSV and XLSX) ────────────────────────
  type CellValue = string | number | null;
  type ColDef = { key: string; label: string };

  const colDefs: ColDef[] = [{ key: 'name', label: isEn ? 'Name' : 'Jméno' }];
  if (col('employmentType')) colDefs.push({ key: 'employmentType', label: isEn ? 'Employment type' : 'Pracovní poměr' });
  if (col('source'))         colDefs.push({ key: 'source', label: isEn ? 'Data source' : 'Zdroj dat' });
  if (col('workedHours'))    colDefs.push({ key: 'workedHours', label: isEn ? 'Hours worked' : 'Odpracováno (h)' });
  if (col('saturdayHours'))  colDefs.push({ key: 'saturdayHours', label: isEn ? 'Of which Saturday' : 'Z toho soboty (h)' });
  if (col('satBonusHours'))  colDefs.push({ key: 'satBonusHours', label: isEn ? 'Saturday bonus (h)' : 'Bonus soboty (h)' });
  if (col('otBonusHours'))   colDefs.push({ key: 'otBonusHours', label: isEn ? 'Overtime bonus (h)' : 'Bonus přesčas (h)' });
  if (includeBenefits) for (const b of activeBenefits) colDefs.push({ key: `benefit_${b.key}`, label: isEn ? `${b.enLabel} (h)` : `${b.czLabel} (h)` });
  if (col('totalBonusHours')) colDefs.push({ key: 'totalBonusHours', label: isEn ? 'Total bonus (h)' : 'Bonus celkem (h)' });
  if (col('finalHours'))     colDefs.push({ key: 'finalHours', label: isEn ? 'Final total (h)' : 'Výsledek (h)' });
  if (col('targetHours'))    colDefs.push({ key: 'targetHours', label: isEn ? 'Target hours' : 'Fond hodin (h)' });
  if (col('delta'))          colDefs.push({ key: 'delta', label: isEn ? 'Difference' : 'Rozdíl (h)' });
  if (col('vacDays'))        colDefs.push({ key: 'vacHours', label: isEn ? 'Vacation used (h)' : 'Dovolená čerpáno (h)' });
  if (col('managerBonus'))   colDefs.push({ key: 'managerBonus', label: isEn ? 'Manager bonus (CZK)' : 'Bonus od vedoucího (Kč)' });
  if (includeRate) {
    colDefs.push({ key: 'hourlyRate', label: isEn ? 'Hourly rate (CZK)' : 'Sazba (Kč/h)' });
    colDefs.push({ key: 'billableTotal', label: isEn ? 'Billable total (CZK)' : 'Mzdový náklad (Kč)' });
  }

  type ExportRow = (typeof rows)[number];
  const valueFor = (r: ExportRow, key: string): CellValue => {
    if (key.startsWith('benefit_')) return r.benefitHours[key.slice(8)] ?? 0;
    switch (key) {
      case 'name': return r.name;
      case 'employmentType': return r.employmentType;
      case 'source': return r.source;
      case 'workedHours': return r.workedHours;
      case 'saturdayHours': return r.saturdayHours;
      case 'satBonusHours': return r.satBonusHours;
      case 'otBonusHours': return r.otBonusHours;
      case 'totalBonusHours': return r.totalBonusHours;
      case 'finalHours': return r.finalHours;
      case 'targetHours': return r.targetHours;
      case 'delta': return r.delta;
      case 'vacHours': return r.vacHours;
      case 'managerBonus': return r.managerBonus;
      case 'hourlyRate': return r.hourlyRate;
      case 'billableTotal': return r.billableTotal;
      default: return null;
    }
  };

  const headers: string[] = colDefs.map((c) => c.label);
  const dataRows: CellValue[][] = rows.map((r) => colDefs.map((c) => valueFor(r, c.key)));

  const baseName = `export-${month}${isEn ? '-en' : ''}`;

  // ── Excel ────────────────────────────────────────────────────────────────────
  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Column widths
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 12) }));

    // ── Live formulas ─────────────────────────────────────────────────────────
    // Derived columns become real Excel formulas referencing the input columns,
    // so editing e.g. the English-lessons hours recalculates everything.
    // When a referenced column is deselected, its computed value is inlined as
    // a constant so the formula stays correct.
    const colIdx = new Map(colDefs.map((c, i) => [c.key, i]));
    const cellRef = (key: string, row: number) => `${XLSX.utils.encode_col(colIdx.get(key)!)}${row}`;
    const refOrConst = (key: string, row: number, constVal: number) =>
      colIdx.has(key) ? cellRef(key, row) : String(Math.round(constVal * 100) / 100);

    rows.forEach((r, i) => {
      const excelRow = i + 2; // 1-based + header row
      const setFormula = (key: string, formula: string, cached: number) => {
        const idx = colIdx.get(key);
        if (idx == null) return;
        ws[`${XLSX.utils.encode_col(idx)}${excelRow}`] = { t: 'n', v: cached, f: formula };
      };

      if (colIdx.has('workedHours')) {
        const worked = cellRef('workedHours', excelRow);

        if (overtimeThreshold > 0) {
          setFormula(
            'otBonusHours',
            `ROUND(MAX(0,${worked}-${overtimeThreshold})*${overtimeBonusPct / 100},2)`,
            r.otBonusHours,
          );
        }

        const satB = refOrConst('satBonusHours', excelRow, r.satBonusHours);
        const otB = refOrConst('otBonusHours', excelRow, r.otBonusHours);
        const benefitTerm = (bKey: string) =>
          colIdx.has(`benefit_${bKey}`) ? cellRef(`benefit_${bKey}`, excelRow) : String(r.benefitHours[bKey] ?? 0);

        if (activeBenefits.length > 0 || colIdx.has('satBonusHours') || colIdx.has('otBonusHours')) {
          const parts = [satB, otB, ...activeBenefits.map((b) => benefitTerm(b.key))];
          setFormula('totalBonusHours', `ROUND(${parts.join('+')},2)`, r.totalBonusHours);
        }

        // Benefit columns carry their own sign (gym/english are negative) → always +
        let finalExpr = `${worked}+${satB}+${otB}`;
        if (activeBenefits.some((b) => b.key === 'blood'))   finalExpr += `+${benefitTerm('blood')}`;
        if (activeBenefits.some((b) => b.key === 'gym'))     finalExpr += `+${benefitTerm('gym')}`;
        if (activeBenefits.some((b) => b.key === 'english')) finalExpr += `+${benefitTerm('english')}`;
        setFormula('finalHours', `ROUND(${finalExpr},2)`, r.finalHours);

        setFormula('delta', `ROUND(${worked}-${refOrConst('targetHours', excelRow, r.targetHours)},2)`, r.delta);
      }

      if (colIdx.has('billableTotal') && r.hourlyRate != null) {
        const fh = colIdx.has('finalHours') ? cellRef('finalHours', excelRow) : String(r.finalHours);
        const mb = refOrConst('managerBonus', excelRow, r.managerBonus);
        setFormula('billableTotal', `ROUND(${fh}*${cellRef('hourlyRate', excelRow)}+${mb},2)`, r.billableTotal ?? 0);
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, isEn ? 'Export' : 'Export');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
      },
    });
  }

  // ── CSV ──────────────────────────────────────────────────────────────────────
  const BOM = '﻿';
  const fmt = (v: CellValue) => v == null ? '' : typeof v === 'number' ? v.toFixed(2) : v;

  const csvLines = [
    headers.join(';'),
    ...dataRows.map((row) => row.map(fmt).join(';')),
  ];
  const csv = BOM + csvLines.join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${baseName}.csv"`,
    },
  });
}
