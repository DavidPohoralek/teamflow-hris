// Sdílený výpočet měsíční docházkové statistiky (agregát na úrovni zaměstnance).
// Používá ho zabezpečený integrační endpoint /api/analytics/summary (rozcestník TeamFlow).
// Záměrně NEMĚNÍME původní /api/analytics/route.ts, aby zůstala živá Analytika beze změny.
// Počítá jen pole potřebná pro týmový souhrn (bez sobotních bonusů, work-type breakdownu apod.).

export type EmployeeStat = {
  workedHours: number;
  targetHours: number;
  utilizationPct: number;
  avgPunctualityMin: number | null;
  overtimeHours: number;
  vacationHoursRemaining: number;
};

export async function computeMonthlyStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  orgId: string,
  month: string,
  opts?: { deptFilter?: string | null; departments?: string[] | null },
): Promise<{ month: string; stats: EmployeeStat[] }> {
  const deptFilter = opts?.deptFilter ?? null;
  const departments = opts?.departments ?? null;

  const [year, mon] = month.split('-').map(Number);
  const dateFrom = `${month}-01`;
  const dateTo = new Date(year, mon, 0).toISOString().slice(0, 10);

  let empQuery = sb
    .from('employees')
    .select('id, department, target_hours, vacation_days_per_year')
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('id');
  if (deptFilter && deptFilter !== '__all__') {
    empQuery = empQuery.eq('department', deptFilter);
  } else if (departments && departments.length > 0) {
    empQuery = empQuery.in('department', departments);
  }

  const [empRes, logsRes, plansRes, requestsRes] = await Promise.all([
    empQuery,
    sb.from('attendance_logs').select('employee_id, check_in, check_out, date').eq('organization_id', orgId).gte('date', dateFrom).lte('date', dateTo),
    sb.from('work_plans').select('employee_id, date, start_time, end_time').eq('organization_id', orgId).eq('active', true).gte('date', dateFrom).lte('date', dateTo),
    sb.from('requests').select('employee_id, date_from, date_to').eq('organization_id', orgId).eq('type', 'vacation').eq('status', 'approved').gte('date_from', `${year}-01-01`).lte('date_from', `${year}-12-31`),
  ]);

  const employees: { id: string; department: string | null; target_hours: number; vacation_days_per_year: number }[] = empRes.data ?? [];
  const logs: { employee_id: string; check_in: string | null; check_out: string | null; date: string }[] = logsRes.data ?? [];
  const plans: { employee_id: string; date: string; start_time: string | null; end_time: string | null }[] = plansRes.data ?? [];
  const vacRequests: { employee_id: string; date_from: string; date_to: string | null }[] = requestsRes.data ?? [];

  function countDays(from: string, to: string | null): number {
    if (!to) return 1;
    const d1 = new Date(from + 'T00:00:00');
    const d2 = new Date(to + 'T00:00:00');
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
  }

  // Plánované časy jsou pražské lokální, check_in/out jsou UTC → porovnáváme v Europe/Prague.
  const pragmaFmt = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false });
  const pragueMins = (isoUtc: string) => {
    const parts = pragmaFmt.formatToParts(new Date(isoUtc));
    return parseInt(parts.find((p) => p.type === 'hour')!.value, 10) * 60
         + parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
  };

  const stats: EmployeeStat[] = employees.map((emp) => {
    const empLogs = logs.filter((l) => l.employee_id === emp.id && l.check_in && l.check_out);
    const empPlans = plans.filter((p) => p.employee_id === emp.id);

    let workedMinutes = 0;
    for (const l of empLogs) {
      workedMinutes += Math.round((new Date(l.check_out!).getTime() - new Date(l.check_in!).getTime()) / 60000);
    }
    const workedHours = workedMinutes / 60;

    let punctualitySum = 0;
    let punctualityCount = 0;
    let overtimeMinutes = 0;
    for (const log of empLogs) {
      const plan = empPlans.find((p) => p.date === log.date);
      if (!plan) continue;
      if (plan.start_time && log.check_in) {
        const [ph, pm] = plan.start_time.split(':').map(Number);
        punctualitySum += pragueMins(log.check_in) - (ph * 60 + pm);
        punctualityCount++;
      }
      if (plan.end_time && log.check_out) {
        const [eh, em] = plan.end_time.split(':').map(Number);
        const diff = pragueMins(log.check_out) - (eh * 60 + em);
        if (diff > 0) overtimeMinutes += diff;
      }
    }
    const avgPunctuality = punctualityCount > 0 ? Math.round(punctualitySum / punctualityCount) : null;

    const vacUsedHours = vacRequests
      .filter((r) => r.employee_id === emp.id)
      .reduce((sum, r) => sum + countDays(r.date_from, r.date_to), 0) * 8;

    const targetHours = emp.target_hours ?? 160;

    return {
      workedHours: Math.round(workedHours * 10) / 10,
      targetHours,
      utilizationPct: targetHours > 0 ? Math.round((workedHours / targetHours) * 100) : 0,
      avgPunctualityMin: avgPunctuality,
      overtimeHours: Math.round(overtimeMinutes / 6) / 10,
      vacationHoursRemaining: Math.max(0, (emp.vacation_days_per_year ?? 20) * 8 - vacUsedHours),
    };
  });

  return { month, stats };
}
