import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/analytics?month=YYYY-MM&department=Prodejna
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase, departments } = resolved;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const deptFilter = searchParams.get('department');

  const [year, mon] = month.split('-').map(Number);
  const dateFrom = `${month}-01`;
  const dateTo = new Date(year, mon, 0).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let empQuery = sb.from('employees').select('id, name, department, target_hours, vacation_days_per_year').eq('organization_id', orgId).eq('active', true).order('name');
  if (deptFilter && deptFilter !== '__all__') {
    empQuery = empQuery.eq('department', deptFilter);
  } else if (departments && departments.length > 0) {
    empQuery = empQuery.in('department', departments);
  }

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

    // Worked hours (total + saturday split)
    // Saturday bonus: per-shift — eligible if work_type_name OR emp.department is in satBonusDepts
    const empDept = emp.department ?? '';
    let workedMinutes = 0;
    let satWorkedMinutes = 0;
    let satBonusMinutes = 0;
    for (const l of empLogs) {
      const diff = new Date(l.check_out!).getTime() - new Date(l.check_in!).getTime();
      const mins = Math.round(diff / 60000);
      workedMinutes += mins;
      if (isSat(l.date)) {
        satWorkedMinutes += mins;
        if (satBonusPct > 0) {
          const logType = l.work_type_name ?? '';
          const eligible = satBonusDepts.length === 0
            || satBonusDepts.includes(empDept)
            || satBonusDepts.includes(logType);
          if (eligible) satBonusMinutes += mins;
        }
      }
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

    // Punctuality (check_in vs planned start_time) + Overtime (check_out vs planned end_time)
    // Both stored as UTC; planned times are Prague local — compare in Prague tz.
    const pragmaFmt = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false });
    const pragueMins = (isoUtc: string) => {
      const parts = pragmaFmt.formatToParts(new Date(isoUtc));
      return parseInt(parts.find((p) => p.type === 'hour')!.value, 10) * 60
           + parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
    };

    let punctualitySum = 0;
    let punctualityCount = 0;
    let overtimeMinutes = 0;  // sum of (actual_end - planned_end) when positive
    let debtMinutes = 0;      // sum of (planned_end - actual_end) when negative

    for (const log of empLogs) {
      const plan = empPlans.find((p) => p.date === log.date);
      if (!plan) continue;

      // Punctuality: check_in vs planned start_time
      if (plan.start_time && log.check_in) {
        const [ph, pm] = plan.start_time.split(':').map(Number);
        const diff = pragueMins(log.check_in) - (ph * 60 + pm);
        punctualitySum += diff;
        punctualityCount++;
      }

      // Overtime/debt: check_out vs planned end_time
      if (plan.end_time && log.check_out) {
        const [eh, em] = plan.end_time.split(':').map(Number);
        const diff = pragueMins(log.check_out) - (eh * 60 + em);
        if (diff > 0) overtimeMinutes += diff;
        else debtMinutes += -diff;
      }
    }
    const avgPunctuality = punctualityCount > 0 ? Math.round(punctualitySum / punctualityCount) : null;

    // Days worked vs days planned
    const daysWorked = new Set(empLogs.map((l) => l.date)).size;
    const daysPlanned = new Set(empPlans.map((p) => p.date)).size;

    // Work-type breakdown for THIS employee (so client může respektovat filtr zaměstnance)
    const wtMins = new Map<string, number>();
    for (const l of empLogs) {
      const key = l.work_type_name ?? 'Neurčeno';
      wtMins.set(key, (wtMins.get(key) ?? 0) + Math.round((new Date(l.check_out!).getTime() - new Date(l.check_in!).getTime()) / 60000));
    }
    const workTypes = Array.from(wtMins.entries()).map(([name, mins]) => ({ name, hours: Math.round(mins / 6) / 10 }));

    // Vacation used this year (in days)
    const vacUsedDays = vacRequests
      .filter((r) => r.employee_id === emp.id)
      .reduce((sum, r) => sum + countDays(r.date_from, r.date_to), 0);

    const targetHours = emp.target_hours ?? 160;
    const satHours = Math.round((satWorkedMinutes / 60) * 10) / 10;
    const satBonusHours = Math.round((satBonusMinutes / 60) * (satBonusPct / 100) * 10) / 10;

    return {
      id: emp.id,
      name: emp.name,
      department: emp.department ?? null,
      workedHours: Math.round(workedHours * 10) / 10,
      plannedHours: Math.round(plannedHours * 10) / 10,
      targetHours,
      utilizationPct: targetHours > 0 ? Math.round((workedHours / targetHours) * 100) : 0,
      daysWorked,
      daysPlanned,
      avgPunctualityMin: avgPunctuality,
      // Per-shift overtime/debt: check_out vs planned end_time
      overtimeHours: Math.round(overtimeMinutes / 6) / 10,
      debtHours: Math.round(debtMinutes / 6) / 10,
      vacationDaysTotal: emp.vacation_days_per_year ?? 20,
      vacationDaysUsed: vacUsedDays,
      vacationDaysRemaining: Math.max(0, (emp.vacation_days_per_year ?? 20) - vacUsedDays),
      saturdayHours: satHours,
      saturdayBonusHours: satBonusHours,
      workTypes,
    };
  });

  // Work type breakdown — only for employees that passed the dept filter
  const filteredEmpIds = new Set(employees.map((e) => e.id));
  const workTypeMap = new Map<string, number>();
  for (const l of logs) {
    if (!l.check_in || !l.check_out) continue;
    if (!filteredEmpIds.has(l.employee_id)) continue;
    const key = l.work_type_name ?? 'Neurčeno';
    const mins = Math.round((new Date(l.check_out).getTime() - new Date(l.check_in).getTime()) / 60000);
    workTypeMap.set(key, (workTypeMap.get(key) ?? 0) + mins);
  }
  const workTypeBreakdown = Array.from(workTypeMap.entries())
    .map(([name, mins]) => ({ name, hours: Math.round(mins / 6) / 10 }))
    .sort((a, b) => b.hours - a.hours);

  return NextResponse.json({ month, stats, workTypeBreakdown });
}
