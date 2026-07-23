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
    sb.from('requests').select('employee_id, date_from, date_to').eq('organization_id', orgId).eq('type', 'vacation').eq('status', 'approved').gte('date_from', `${year}-01-01`).lte('date_from', `${year}-12-31`),
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
  // Manager-granted monthly bonuses (CZK) — table may not exist yet, then the map stays empty
  const managerBonusMap = new Map<string, number>(
    ((bonusRes?.data ?? []) as { employee_id: string; amount: number }[]).map((b) => [b.employee_id, Number(b.amount) || 0])
  );

  function isSat(dateStr: string) { return new Date(dateStr + 'T00:00:00').getDay() === 6; }

  function countVacHours(empId: string): number {
    const days = vacReqs.filter((r) => r.employee_id === empId).reduce((sum, r) => {
      if (!r.date_to) return sum + 1;
      const d1 = new Date(r.date_from + 'T00:00:00');
      const d2 = new Date(r.date_to + 'T00:00:00');
      return sum + Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
    }, 0);
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
    const finalHours = Math.round((
      workedHours + satBonusHours + otBonusHours
      + (benefitHours['blood'] ?? 0)
      - (benefitHours['gym'] ?? 0)
      - (benefitHours['english'] ?? 0)
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
      vacHours: countVacHours(emp.id),
      managerBonus,
      hourlyRate,
      billableTotal,
    };
  });

  const isEn = lang === 'en';
  const includeBenefits = col('benefits') && activeBenefits.length > 0;

  // ── Build header/row arrays (shared for CSV and XLSX) ────────────────────────
  type CellValue = string | number | null;

  const headers: string[] = [
    isEn ? 'Name' : 'Jméno',
    ...(col('employmentType') ? [isEn ? 'Employment type' : 'Pracovní poměr'] : []),
    ...(col('source')         ? [isEn ? 'Data source'     : 'Zdroj dat']      : []),
    ...(col('workedHours')    ? [isEn ? 'Hours worked'    : 'Odpracováno (h)'] : []),
    ...(col('saturdayHours')  ? [isEn ? 'Of which Saturday' : 'Z toho soboty (h)'] : []),
    ...(col('satBonusHours')  ? [isEn ? 'Saturday bonus (h)' : 'Bonus soboty (h)'] : []),
    ...(col('otBonusHours')   ? [isEn ? 'Overtime bonus (h)' : 'Bonus přesčas (h)'] : []),
    ...(includeBenefits ? activeBenefits.map((b) => isEn ? `${b.enLabel} (h)` : `${b.czLabel} (h)`) : []),
    ...(col('totalBonusHours') ? [isEn ? 'Total bonus (h)' : 'Bonus celkem (h)'] : []),
    ...(col('finalHours')     ? [isEn ? 'Final total (h)' : 'Výsledek (h)']    : []),
    ...(col('targetHours')    ? [isEn ? 'Target hours'    : 'Fond hodin (h)']  : []),
    ...(col('delta')          ? [isEn ? 'Difference'      : 'Rozdíl (h)']      : []),
    ...(col('vacDays')        ? [isEn ? 'Vacation used (h)' : 'Dovolená čerpáno (h)'] : []),
    ...(col('managerBonus')   ? [isEn ? 'Manager bonus (CZK)' : 'Bonus od vedoucího (Kč)'] : []),
    ...(includeRate           ? [isEn ? 'Hourly rate (CZK)' : 'Sazba (Kč/h)']  : []),
    ...(includeRate           ? [isEn ? 'Billable total (CZK)' : 'Mzdový náklad (Kč)'] : []),
  ];

  const dataRows: CellValue[][] = rows.map((r) => [
    r.name,
    ...(col('employmentType') ? [r.employmentType]        : []),
    ...(col('source')         ? [r.source]                : []),
    ...(col('workedHours')    ? [r.workedHours]            : []),
    ...(col('saturdayHours')  ? [r.saturdayHours]          : []),
    ...(col('satBonusHours')  ? [r.satBonusHours]          : []),
    ...(col('otBonusHours')   ? [r.otBonusHours]           : []),
    ...(includeBenefits ? activeBenefits.map((b) => r.benefitHours[b.key] ?? 0) : []),
    ...(col('totalBonusHours') ? [r.totalBonusHours]       : []),
    ...(col('finalHours')     ? [r.finalHours]             : []),
    ...(col('targetHours')    ? [r.targetHours]            : []),
    ...(col('delta')          ? [r.delta]                  : []),
    ...(col('vacDays')        ? [r.vacHours]               : []),
    ...(col('managerBonus')   ? [r.managerBonus]           : []),
    ...(includeRate           ? [r.hourlyRate]             : []),
    ...(includeRate           ? [r.billableTotal]          : []),
  ]);

  const baseName = `export-${month}${isEn ? '-en' : ''}`;

  // ── Excel ────────────────────────────────────────────────────────────────────
  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Column widths
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 12) }));

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
