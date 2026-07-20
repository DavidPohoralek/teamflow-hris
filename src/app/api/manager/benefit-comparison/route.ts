// GET /api/manager/benefit-comparison?month=YYYY-MM
// Returns per-employee comparison: how many times they checked in with each activity work type
// vs. how many benefit entries were deducted for the same benefit.
import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

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

  const [activityTypesRes, logsRes, benefitLogsRes, empsRes] = await Promise.all([
    // Activity work types that have a benefit_key
    sb.from('work_types')
      .select('id, name, benefit_key, color')
      .eq('organization_id', orgId)
      .eq('active', true)
      .eq('category', 'activity'),

    // Attendance logs for the month — work_type_name matches activity names
    sb.from('attendance_logs')
      .select('employee_id, work_type_name')
      .eq('organization_id', orgId)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .not('check_in', 'is', null)
      .not('check_out', 'is', null),

    // Benefit logs (deductions) for the month
    sb.from('employee_benefit_logs')
      .select('employee_id, benefit_key, count')
      .eq('organization_id', orgId)
      .eq('month', month),

    // Active employees
    sb.from('employees')
      .select('id, name, department')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
  ]);

  const activityTypes: { id: string; name: string; benefit_key: string | null; color: string }[] = activityTypesRes.data ?? [];
  const logs: { employee_id: string; work_type_name: string | null }[] = logsRes.data ?? [];
  const benefitLogs: { employee_id: string; benefit_key: string; count: number }[] = benefitLogsRes.data ?? [];
  const employees: { id: string; name: string; department: string | null }[] = empsRes.data ?? [];

  // Build a set of activity work type names for fast lookup
  const activityNameSet = new Set(activityTypes.map((a) => a.name));

  // Only keep logs that match an activity name
  const activityLogs = logs.filter((l) => l.work_type_name && activityNameSet.has(l.work_type_name));

  // Per-employee, per-activity-name: count of attendance logs
  const attendedByEmpAndName: Record<string, Record<string, number>> = {};
  for (const log of activityLogs) {
    if (!log.work_type_name) continue;
    if (!attendedByEmpAndName[log.employee_id]) attendedByEmpAndName[log.employee_id] = {};
    attendedByEmpAndName[log.employee_id][log.work_type_name] =
      (attendedByEmpAndName[log.employee_id][log.work_type_name] ?? 0) + 1;
  }

  // Per-employee, per-benefit_key: deducted count
  const deductedByEmpAndKey: Record<string, Record<string, number>> = {};
  for (const bl of benefitLogs) {
    if (!deductedByEmpAndKey[bl.employee_id]) deductedByEmpAndKey[bl.employee_id] = {};
    deductedByEmpAndKey[bl.employee_id][bl.benefit_key] = bl.count;
  }

  // Build result: only include employees who have any activity data
  const result = employees
    .map((emp) => {
      const attended = attendedByEmpAndName[emp.id] ?? {};
      const deducted = deductedByEmpAndKey[emp.id] ?? {};

      const activities = activityTypes.map((at) => {
        const attendedCount = attended[at.name] ?? 0;
        const deductedCount = at.benefit_key ? (deducted[at.benefit_key] ?? 0) : null;
        return {
          name: at.name,
          benefit_key: at.benefit_key,
          color: at.color,
          attended: attendedCount,
          deducted: deductedCount,
          diff: deductedCount != null ? attendedCount - deductedCount : null,
        };
      });

      const hasAny = activities.some((a) => a.attended > 0 || (a.deducted ?? 0) > 0);
      return { employeeId: emp.id, name: emp.name, department: emp.department, activities, hasAny };
    })
    .filter((r) => r.hasAny);

  return NextResponse.json({ month, activityTypes, employees: result });
}
