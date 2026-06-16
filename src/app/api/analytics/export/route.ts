import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/analytics/export?month=YYYY-MM
// Returns CSV with employee hours + bonuses
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  const [year, mon] = month.split('-').map(Number);
  const dateFrom = `${month}-01`;
  const dateTo = new Date(year, mon, 0).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Load bonus settings from company_settings
  const { data: settingsRows } = await sb
    .from('company_settings')
    .select('key, value')
    .eq('organization_id', orgId)
    .in('key', ['bonus_saturday_pct', 'bonus_overtime_threshold', 'bonus_overtime_pct', 'bonus_holiday_pct']);

  const settings: Record<string, number> = {};
  for (const row of settingsRows ?? []) {
    settings[row.key] = parseFloat(row.value) || 0;
  }
  const saturdayBonus = settings['bonus_saturday_pct'] ?? 10; // % bonus for Saturday hours
  const overtimeThreshold = settings['bonus_overtime_threshold'] ?? 0; // hours after which overtime applies
  const overtimeBonus = settings['bonus_overtime_pct'] ?? 25; // % bonus for overtime
  const holidayBonus = settings['bonus_holiday_pct'] ?? 25; // % bonus for public holidays (manual tag)

  const [empRes, logsRes, plansRes, vacRes] = await Promise.all([
    sb.from('employees').select('id, name, target_hours, employment_type').eq('organization_id', orgId).eq('active', true).order('name'),
    sb.from('attendance_logs').select('employee_id, check_in, check_out, date').eq('organization_id', orgId).gte('date', dateFrom).lte('date', dateTo),
    sb.from('work_plans').select('employee_id, date, start_time, end_time').eq('organization_id', orgId).eq('active', true).gte('date', dateFrom).lte('date', dateTo),
    sb.from('requests').select('employee_id, date_from, date_to').eq('organization_id', orgId).eq('type', 'vacation').eq('status', 'approved').gte('date_from', `${year}-01-01`).lte('date_from', `${year}-12-31`),
  ]);

  const employees: { id: string; name: string; target_hours: number; employment_type?: string }[] = empRes.data ?? [];
  const logs: { employee_id: string; check_in: string; check_out: string; date: string }[] = logsRes.data ?? [];
  const plans: { employee_id: string; date: string; start_time: string | null; end_time: string | null }[] = plansRes.data ?? [];
  const vacReqs: { employee_id: string; date_from: string; date_to: string | null }[] = vacRes.data ?? [];

  function isSaturday(dateStr: string): boolean {
    return new Date(dateStr + 'T00:00:00').getDay() === 6;
  }

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

    let regularMins = 0;
    let saturdayMins = 0;

    // Worked hours from attendance_logs (kiosk check-in/out)
    for (const log of empLogs) {
      const mins = Math.round((new Date(log.check_out).getTime() - new Date(log.check_in).getTime()) / 60000);
      if (isSaturday(log.date)) saturdayMins += mins;
      else regularMins += mins;
    }

    // Fallback: if no attendance logs, estimate from work_plans
    let plannedMins = 0;
    let plannedSatMins = 0;
    for (const p of empPlans) {
      let mins = 8 * 60;
      if (p.start_time && p.end_time) {
        const [sh, sm] = p.start_time.split(':').map(Number);
        const [eh, em] = p.end_time.split(':').map(Number);
        mins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      }
      if (isSaturday(p.date)) plannedSatMins += mins;
      else plannedMins += mins;
    }

    const hasAttendance = empLogs.length > 0;
    const effectiveRegularMins = hasAttendance ? regularMins : plannedMins;
    const effectiveSatMins = hasAttendance ? saturdayMins : plannedSatMins;

    const regularHours = effectiveRegularMins / 60;
    const saturdayHours = effectiveSatMins / 60;
    const totalWorked = regularHours + saturdayHours;

    // Bonus hours calculation
    const saturdayBonusHours = saturdayHours * (saturdayBonus / 100);
    let overtimeBonusHours = 0;
    if (overtimeThreshold > 0 && totalWorked > overtimeThreshold) {
      overtimeBonusHours = (totalWorked - overtimeThreshold) * (overtimeBonus / 100);
    }
    const totalBonusHours = saturdayBonusHours + overtimeBonusHours;

    const targetHours = emp.target_hours ?? 160;
    const delta = totalWorked - targetHours;
    const vacDays = countVacDays(emp.id);

    return {
      name: emp.name,
      employmentType: emp.employment_type ?? 'hpp',
      source: hasAttendance ? 'docházka' : 'plán',
      workedHours: Math.round(totalWorked * 100) / 100,
      saturdayHours: Math.round(saturdayHours * 100) / 100,
      bonusHours: Math.round(totalBonusHours * 100) / 100,
      saturdayBonusHours: Math.round(saturdayBonusHours * 100) / 100,
      overtimeBonusHours: Math.round(overtimeBonusHours * 100) / 100,
      targetHours,
      delta: Math.round(delta * 100) / 100,
      vacationDaysUsed: vacDays,
    };
  });

  // Build CSV — semicolon delimiter, comma decimal separator, UTF-8 BOM for Excel
  const BOM = '﻿';
  const EMPLOYMENT_LABELS: Record<string, string> = {
    hpp: 'HPP',
    dpp: 'DPP',
    dpc: 'DPČ',
    ico: 'IČO',
  };

  const header = [
    'Jméno',
    'Pracovní poměr',
    'Zdroj dat',
    'Odpracováno (h)',
    'Z toho soboty (h)',
    'Bonus soboty (h)',
    'Bonus přesčas (h)',
    'Bonus celkem (h)',
    'Fond hodin (h)',
    'Rozdíl (h)',
    'Dovolená čerpáno (dní)',
  ].join(';');

  const fmt = (n: number) => String(n).replace('.', ',');

  const csvRows = rows.map((r) =>
    [
      r.name,
      EMPLOYMENT_LABELS[r.employmentType] ?? r.employmentType,
      r.source,
      fmt(r.workedHours),
      fmt(r.saturdayHours),
      fmt(r.saturdayBonusHours),
      fmt(r.overtimeBonusHours),
      fmt(r.bonusHours),
      fmt(r.targetHours),
      fmt(r.delta),
      String(r.vacationDaysUsed),
    ].join(';')
  );

  const csv = BOM + [header, ...csvRows].join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="export-${month}.csv"`,
    },
  });
}
