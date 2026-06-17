import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/analytics/export?month=YYYY-MM&lang=cs|en
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const lang = (searchParams.get('lang') ?? 'cs') as 'cs' | 'en';

  const [year, mon] = month.split('-').map(Number);
  const dateFrom = `${month}-01`;
  const dateTo = new Date(year, mon, 0).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Load bonus settings
  const { data: settingsRows } = await sb
    .from('company_settings')
    .select('key, value')
    .eq('organization_id', orgId)
    .in('key', ['bonus_saturday_pct', 'bonus_overtime_threshold', 'bonus_overtime_pct']);

  const settings: Record<string, number> = {};
  for (const row of settingsRows ?? []) settings[row.key] = parseFloat(row.value) || 0;
  const saturdayBonusPct = settings['bonus_saturday_pct'] ?? 10;
  const overtimeThreshold = settings['bonus_overtime_threshold'] ?? 0;
  const overtimeBonusPct = settings['bonus_overtime_pct'] ?? 25;

  const [empRes, logsRes, plansRes, vacRes] = await Promise.all([
    sb.from('employees').select('id, name, target_hours, employment_type, vacation_days_per_year').eq('organization_id', orgId).eq('active', true).order('name'),
    sb.from('attendance_logs').select('employee_id, check_in, check_out, date').eq('organization_id', orgId).gte('date', dateFrom).lte('date', dateTo),
    sb.from('work_plans').select('employee_id, date, start_time, end_time').eq('organization_id', orgId).eq('active', true).gte('date', dateFrom).lte('date', dateTo),
    sb.from('requests').select('employee_id, date_from, date_to').eq('organization_id', orgId).eq('type', 'vacation').eq('status', 'approved').gte('date_from', `${year}-01-01`).lte('date_from', `${year}-12-31`),
  ]);

  const employees: { id: string; name: string; target_hours: number; employment_type?: string; vacation_days_per_year?: number }[] = empRes.data ?? [];
  const logs: { employee_id: string; check_in: string; check_out: string; date: string }[] = logsRes.data ?? [];
  const plans: { employee_id: string; date: string; start_time: string | null; end_time: string | null }[] = plansRes.data ?? [];
  const vacReqs: { employee_id: string; date_from: string; date_to: string | null }[] = vacRes.data ?? [];

  function isSat(dateStr: string) { return new Date(dateStr + 'T00:00:00').getDay() === 6; }

  function countVacDays(empId: string): number {
    return vacReqs.filter((r) => r.employee_id === empId).reduce((sum, r) => {
      if (!r.date_to) return sum + 1;
      const d1 = new Date(r.date_from + 'T00:00:00');
      const d2 = new Date(r.date_to + 'T00:00:00');
      return sum + Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
    }, 0);
  }

  const rows = employees.map((emp) => {
    const empLogs = logs.filter((l) => l.employee_id === emp.id && l.check_in && l.check_out);
    const empPlans = plans.filter((p) => p.employee_id === emp.id);
    const hasAttendance = empLogs.length > 0;

    // — same calculation as /api/analytics —
    let workedMinutes = 0;
    let saturdayMinutes = 0;

    if (hasAttendance) {
      for (const l of empLogs) {
        const mins = Math.round((new Date(l.check_out).getTime() - new Date(l.check_in).getTime()) / 60000);
        workedMinutes += mins;
        if (isSat(l.date)) saturdayMinutes += mins;
      }
    } else {
      for (const p of empPlans) {
        let mins = 8 * 60;
        if (p.start_time && p.end_time) {
          const [sh, sm] = p.start_time.split(':').map(Number);
          const [eh, em] = p.end_time.split(':').map(Number);
          mins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
        }
        workedMinutes += mins;
        if (isSat(p.date)) saturdayMinutes += mins;
      }
    }

    const workedHours = workedMinutes / 60;
    const saturdayHours = saturdayMinutes / 60;

    // Bonus calculation
    const satBonusHours = saturdayHours * (saturdayBonusPct / 100);
    let otBonusHours = 0;
    if (overtimeThreshold > 0 && workedHours > overtimeThreshold) {
      otBonusHours = (workedHours - overtimeThreshold) * (overtimeBonusPct / 100);
    }
    const totalBonusHours = satBonusHours + otBonusHours;

    const targetHours = emp.target_hours ?? 160;

    return {
      name: emp.name,
      employmentType: emp.employment_type ?? '',
      source: hasAttendance ? (lang === 'en' ? 'attendance' : 'docházka') : (lang === 'en' ? 'plan' : 'plán'),
      workedHours: Math.round(workedHours * 100) / 100,
      saturdayHours: Math.round(saturdayHours * 100) / 100,
      satBonusHours: Math.round(satBonusHours * 100) / 100,
      otBonusHours: Math.round(otBonusHours * 100) / 100,
      totalBonusHours: Math.round(totalBonusHours * 100) / 100,
      targetHours,
      delta: Math.round((workedHours - targetHours) * 100) / 100,
      vacDays: countVacDays(emp.id),
    };
  });

  const isEn = lang === 'en';
  const BOM = '﻿';

  // Legacy keys → display label; custom types stored as-is
  const LEGACY: Record<string, string> = { hpp: 'HPP', dpp: 'DPP', dpc: 'DPČ', ico: 'IČO' };

  const fmt = (n: number) => {
    const s = n.toFixed(2);
    return isEn ? s : s.replace('.', ',');
  };

  const header = isEn
    ? ['Name', 'Employment type', 'Data source', 'Hours worked', 'Of which Saturday', 'Saturday bonus (h)', 'Overtime bonus (h)', 'Total bonus (h)', 'Target hours', 'Difference', 'Vacation days used'].join(';')
    : ['Jméno', 'Pracovní poměr', 'Zdroj dat', 'Odpracováno (h)', 'Z toho soboty (h)', 'Bonus soboty (h)', 'Bonus přesčas (h)', 'Bonus celkem (h)', 'Fond hodin (h)', 'Rozdíl (h)', 'Dovolená čerpáno (dní)'].join(';');

  const csvRows = rows.map((r) =>
    [
      r.name,
      LEGACY[r.employmentType] ?? r.employmentType,
      r.source,
      fmt(r.workedHours),
      fmt(r.saturdayHours),
      fmt(r.satBonusHours),
      fmt(r.otBonusHours),
      fmt(r.totalBonusHours),
      fmt(r.targetHours),
      fmt(r.delta),
      String(r.vacDays),
    ].join(';')
  );

  const csv = BOM + [header, ...csvRows].join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="export-${month}${isEn ? '-en' : ''}.csv"`,
    },
  });
}
