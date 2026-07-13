import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/analytics/daily?month=YYYY-MM&department=X
// Returns one point per calendar day: planned hours vs worked hours (team total)
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

  let empQuery = sb.from('employees').select('id').eq('organization_id', orgId).eq('active', true);
  if (deptFilter && deptFilter !== '__all__') {
    empQuery = empQuery.eq('department', deptFilter);
  } else if (departments?.length) {
    empQuery = empQuery.in('department', departments);
  }

  const [empRes, logsRes, plansRes] = await Promise.all([
    empQuery,
    sb.from('attendance_logs')
      .select('employee_id, date, check_in, check_out')
      .eq('organization_id', orgId)
      .gte('date', dateFrom).lte('date', dateTo),
    sb.from('work_plans')
      .select('employee_id, date, start_time, end_time')
      .eq('organization_id', orgId).eq('active', true)
      .gte('date', dateFrom).lte('date', dateTo),
  ]);

  const empIds = new Set<string>((empRes.data ?? []).map((e: { id: string }) => e.id));

  const workedByDate = new Map<string, number>();
  for (const l of (logsRes.data ?? [])) {
    if (!empIds.has(l.employee_id) || !l.check_in || !l.check_out) continue;
    const mins = Math.round((new Date(l.check_out).getTime() - new Date(l.check_in).getTime()) / 60000);
    workedByDate.set(l.date, (workedByDate.get(l.date) ?? 0) + Math.max(0, mins));
  }

  const plannedByDate = new Map<string, number>();
  for (const p of (plansRes.data ?? [])) {
    if (!empIds.has(p.employee_id)) continue;
    let mins = 8 * 60;
    if (p.start_time && p.end_time) {
      const [sh, sm] = (p.start_time as string).split(':').map(Number);
      const [eh, em] = (p.end_time as string).split(':').map(Number);
      mins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    }
    plannedByDate.set(p.date, (plannedByDate.get(p.date) ?? 0) + mins);
  }

  const result = [];
  const d = new Date(year, mon - 1, 1);
  while (d.getMonth() === mon - 1) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dow = d.getDay();
    result.push({
      date: dateStr,
      dayLabel: String(d.getDate()),
      isWeekend: dow === 0 || dow === 6,
      plannedHours: Math.round((plannedByDate.get(dateStr) ?? 0) / 6) / 10,
      workedHours: Math.round((workedByDate.get(dateStr) ?? 0) / 6) / 10,
    });
    d.setDate(d.getDate() + 1);
  }

  return NextResponse.json(result);
}
