// GET /api/manager/planned-hours?month=YYYY-MM
// Returns planned shift hours per employee for the given month (defaults to the
// current Prague month). Used by the Manager panel Employees table to show
// "Fond vs naplánováno" (target hours vs planned hours).
import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { pragueMonth } from '@/lib/vacationDays';

export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const monthParam = new URL(req.url).searchParams.get('month');
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : pragueMonth();
  const dateFrom = `${month}-01`;
  const dateTo = `${month}-31`;

  const plans = await fetchAllRows<{ employee_id: string; start_time: string | null; end_time: string | null }>((from, to) =>
    sb.from('work_plans')
      .select('employee_id, start_time, end_time')
      .eq('organization_id', orgId)
      .eq('active', true)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .range(from, to));

  const hoursByEmployee: Record<string, number> = {};
  for (const p of plans) {
    let minutes = 8 * 60; // full-day default when no explicit times (matches shift grids)
    if (p.start_time && p.end_time) {
      const [sh, sm] = p.start_time.split(':').map(Number);
      const [eh, em] = p.end_time.split(':').map(Number);
      minutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    }
    hoursByEmployee[p.employee_id] = (hoursByEmployee[p.employee_id] ?? 0) + minutes / 60;
  }

  // Round to whole hours for display
  for (const id of Object.keys(hoursByEmployee)) hoursByEmployee[id] = Math.round(hoursByEmployee[id]);

  return NextResponse.json({ month, hoursByEmployee });
}
