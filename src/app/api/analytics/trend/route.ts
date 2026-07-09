import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import { fetchAllRows } from '@/lib/fetchAllRows';

// GET /api/analytics/trend?month=YYYY-MM&department=Prodejna
// Returns 12 data points (last 12 months) for AreaChart
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase, departments } = resolved;

  const { searchParams } = new URL(req.url);
  const endMonth = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const deptFilter = searchParams.get('department');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Build 12-month window ending at endMonth
  const [ey, em] = endMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    let y = ey; let m = em - i;
    while (m <= 0) { m += 12; y--; }
    months.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  const rangeFrom = `${months[0]}-01`;
  const [ly, lm] = months[11].split('-').map(Number);
  const rangeTo = new Date(ly, lm, 0).toISOString().slice(0, 10);

  let empQuery = sb.from('employees')
    .select('id, target_hours')
    .eq('organization_id', orgId)
    .eq('active', true);
  if (deptFilter && deptFilter !== '__all__') {
    empQuery = empQuery.eq('department', deptFilter);
  } else if (departments?.length) {
    empQuery = empQuery.in('department', departments);
  }

  const [empRes, allLogs] = await Promise.all([
    empQuery,
    // stránkovat přes 1000-řádkový limit (12 měsíců docházky může být >1000 řádků)
    fetchAllRows<{ employee_id: string; date: string; check_in: string | null; check_out: string | null }>(
      (from, to) => sb.from('attendance_logs')
        .select('employee_id, date, check_in, check_out')
        .eq('organization_id', orgId)
        .gte('date', rangeFrom)
        .lte('date', rangeTo)
        .order('date', { ascending: true })
        .range(from, to),
    ),
  ]);

  const employees: { id: string; target_hours: number }[] = empRes.data ?? [];

  const empIds = new Set(employees.map((e) => e.id));
  const relevantLogs = allLogs.filter((l) => empIds.has(l.employee_id) && l.check_in && l.check_out);
  // Monthly target = sum of all employees' target_hours (contractual monthly obligation)
  const totalTarget = employees.reduce((s, e) => s + (e.target_hours ?? 160), 0);

  const CZ_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

  const result = months.map((month) => {
    const [my, mm] = month.split('-').map(Number);
    const monthFrom = `${month}-01`;
    const monthTo = new Date(my, mm, 0).toISOString().slice(0, 10);

    const monthLogs = relevantLogs.filter((l) => l.date >= monthFrom && l.date <= monthTo);
    const workedMinutes = monthLogs.reduce((s, l) => {
      const ms = new Date(l.check_out!).getTime() - new Date(l.check_in!).getTime();
      return s + Math.max(0, Math.round(ms / 60000));
    }, 0);
    const workedHours = Math.round(workedMinutes / 6) / 10;

    return {
      month,
      monthLabel: `${CZ_SHORT[mm - 1]} '${String(my).slice(2)}`,
      workedHours,
      targetHours: totalTarget,
      utilizationPct: totalTarget > 0 ? Math.round((workedHours / totalTarget) * 100) : 0,
    };
  });

  return NextResponse.json(result);
}
