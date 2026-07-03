import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/analytics?month=YYYY-MM
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase, departments } = resolved;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  const [year, mon] = month.split('-').map(Number);
  const dateFrom = `${month}-01`;
  const dateTo = new Date(year, mon, 0).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let empQuery = sb.from('employees').select('id, name, department, target_hours, vacation_days_per_year').eq('organization_id', orgId).eq('active', true).order('name');
  if (departments && departments.length > 0) empQuery = empQuery.in('department', departments);

  const [empRes, logsRes, plansRes, requestsRes, settingsRes] = await Promise.all([
    empQuery,
    sb.from('attendance_logs').select('employee_id, check_in, check_out, work_type_name, date').eq('organization_id', orgId).gte('date', dateFrom).lte('date', dateTo),
    sb.from('work_plans').select('employee_id, date, start_time, end_time, work_type').eq('organization_id', orgId).eq('active', true).gte('date', dateFrom).lte('date', dateTo),
    sb.from('requests').select('employee_id, type, status, date_from, date_to').eq('organization_id', orgId).eq('type', 'vacation').eq('status', 'approved').gte('date_from', `${year}-01-01`).lte('date_from', `${year}-12-31`),
    sb.from('company_settings').select('extra_settings').eq('organization_id', orgId).maybeSingle(),
  ]);

  const extra: Record<string, unknown> = (settingsRes.data?.extra_settings ?? {}) as Record<string, unknown>;
  const satBonusPct: number = typeof extra['bonus_saturday_pct'] === 'number' ? extra['bonus_saturday_pct'] : Number(extra['bonus_saturday_pct'] ?? 0);
  const satBonusDepts: string[] = Array.isArray(extra['bonus_saturday_departments']) ? (extra['bonus_saturday_departments'] as string[]) : [];

  function isSat(dateStr: string): boolean { return new Date(dateStr + 'T12:00:00').getDay() === 6; }

  const employees: { id: string; name: string; department: string | null; target_hours: number; vacation_days_per_year: number }[] = empRes.data ?? [];
  const logs: { employee_id: string; check_in: string | null; check_out: string | null; work_type_name: string | null; date: string }[] = logsRes.data ?? [];
  const plans: { employee_id: string; date: string; start_time: string | null; end_time: string | null; work_type: string }[] = plansRes.data ?? [];
  const vacRequests: { employee_id: string; date_from: string; date_to: string | null }[] = requestsRes.data ?? [];

  function countDays(from: string, to: string | null): number {
    if (!to) return 1;
    const d1 = new Date(from + 'T00:00:00');
    const d2 = new Date(to + 'T00:00:00');
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
  }

  const stats = employees.map((emp) => {
    const empLogs = logs.filter((l) => l.employee_id === emp.id && l.check_in && l.check_out);
    const empPlans = plans.filter((p) => p.employee_id === emp.id);

    // Saturday bonus eligibility
    const empDept = emp.department ?? '';
    const satEligible = satBonusPct > 0 && (satBonusDepts.length === 0 || satBonusDepts.includes(empDept));

    // Worked hours (total + saturday split)
    let workedMinutes = 0;
    let satWorkedMinutes = 0;
    for (const l of empLogs) {
      const diff = new Date(l.check_out!).getTime() - new Date(l.check_in!).getTime();
      const mins = Math.round(diff / 60000);
      workedMinutes += mins;
      if (isSat(l.date)) satWorkedMinutes += mins;
    }
    const workedHours = workedMinutes / 60;

    // Planned hours (from work_plans)
    const plannedMinutes = empPlans.reduce((sum, p) => {
      if (!p.start_time || !p.end_time) return sum + 8 * 60;
      const [sh, sm] = p.start_time.split(':').map(Number);
      const [eh, em] = p.end_time.split(':').map(Number);
      return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    }, 0);
    const plannedHours = plannedMinutes / 60;

    // Punctuality: avg deviation (check_in vs planned start_time) in minutes
    let punctualitySum = 0;
    let punctualityCount = 0;
    for (const log of empLogs) {
      const plan = empPlans.find((p) => p.date === log.date && p.start_time);
      if (!plan?.start_time || !log.check_in) continue;
      const [ph, pm] = plan.start_time.split(':').map(Number);
      const planned = new Date(log.date + 'T' + plan.start_time + ':00');
      const actual = new Date(log.check_in);
      punctualitySum += Math.round((actual.getTime() - planned.getTime()) / 60000);
      punctualityCount++;
    }
    const avgPunctuality = punctualityCount > 0 ? Math.round(punctualitySum / punctualityCount) : null;

    // Days worked vs days planned
    const daysWorked = new Set(empLogs.map((l) => l.date)).size;
    const daysPlanned = new Set(empPlans.map((p) => p.date)).size;

    // Vacation used this year (in days)
    const vacUsedDays = vacRequests
      .filter((r) => r.employee_id === emp.id)
      .reduce((sum, r) => sum + countDays(r.date_from, r.date_to), 0);

    const targetHours = emp.target_hours ?? 160;
    const satHours = Math.round((satWorkedMinutes / 60) * 10) / 10;
    const satBonusHours = satEligible ? Math.round(satHours * (satBonusPct / 100) * 10) / 10 : 0;

    return {
      id: emp.id,
      name: emp.name,
      workedHours: Math.round(workedHours * 10) / 10,
      plannedHours: Math.round(plannedHours * 10) / 10,
      targetHours,
      utilizationPct: targetHours > 0 ? Math.round((workedHours / targetHours) * 100) : 0,
      daysWorked,
      daysPlanned,
      avgPunctualityMin: avgPunctuality,
      vacationDaysTotal: emp.vacation_days_per_year ?? 20,
      vacationDaysUsed: vacUsedDays,
      vacationDaysRemaining: Math.max(0, (emp.vacation_days_per_year ?? 20) - vacUsedDays),
      saturdayHours: satHours,
      saturdayBonusHours: satBonusHours,
    };
  });

  // Work type breakdown across org
  const workTypeMap = new Map<string, number>();
  for (const l of logs) {
    if (!l.check_in || !l.check_out) continue;
    const key = l.work_type_name ?? 'Neurčeno';
    const mins = Math.round((new Date(l.check_out).getTime() - new Date(l.check_in).getTime()) / 60000);
    workTypeMap.set(key, (workTypeMap.get(key) ?? 0) + mins);
  }
  const workTypeBreakdown = Array.from(workTypeMap.entries())
    .map(([name, mins]) => ({ name, hours: Math.round(mins / 6) / 10 }))
    .sort((a, b) => b.hours - a.hours);

  return NextResponse.json({ month, stats, workTypeBreakdown });
}
