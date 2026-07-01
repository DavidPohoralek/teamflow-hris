// GET /api/manager/vacation-balances
// Returns vacation balance for all active employees
import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

function countVacationDays(dateFrom: string, dateTo: string | null, countWeekends: boolean = false): number {
  const from = new Date(dateFrom + 'T00:00:00');
  const to = dateTo ? new Date(dateTo + 'T00:00:00') : from;
  let days = 0;
  const cur = new Date(from);
  while (cur <= to) {
    const dow = cur.getDay();
    if (countWeekends || (dow !== 0 && dow !== 6)) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const currentYear = new Date().getFullYear();

  const [empsRes, requestsRes, settingsRes] = await Promise.all([
    sb.from('employees').select('id, name, vacation_days_per_year, employment_type').eq('organization_id', orgId).eq('active', true).order('name'),
    sb.from('requests').select('employee_id, date_from, date_to, status').eq('organization_id', orgId).eq('type', 'vacation').gte('date_from', `${currentYear}-01-01`).lte('date_from', `${currentYear}-12-31`),
    sb.from('company_settings').select('extra_settings').eq('organization_id', orgId).maybeSingle(),
  ]);

  const extraSettings = (settingsRes.data as { extra_settings?: Record<string, unknown> | null } | null)?.extra_settings ?? {};
  const configs = (extraSettings.employment_type_configs as Record<string, { paidVacation: boolean }> | undefined) ?? {};
  const countWeekends = (extraSettings.vacation_counting_mode as string | undefined) === 'all';
  const defaultVacationDays = typeof extraSettings.default_vacation_days === 'number' ? extraSettings.default_vacation_days : 20;
  const DEFAULT_PAID: Record<string, boolean> = { HPP: true, DPP: true, 'DPČ': true, 'IČO': false };

  // Group requests by employee
  const byEmployee: Record<string, { usedDays: number; pendingDays: number }> = {};
  for (const req of (requestsRes.data ?? [])) {
    if (!byEmployee[req.employee_id]) byEmployee[req.employee_id] = { usedDays: 0, pendingDays: 0 };
    const days = countVacationDays(req.date_from, req.date_to ?? null, countWeekends);
    if (req.status === 'approved') byEmployee[req.employee_id].usedDays += days;
    else if (req.status === 'pending') byEmployee[req.employee_id].pendingDays += days;
  }

  const balances = (empsRes.data ?? []).map((emp: { id: string; name: string; vacation_days_per_year?: number; employment_type?: string }) => {
    const empType = emp.employment_type ?? '';
    const hasPaidVacation = configs[empType]?.paidVacation ?? DEFAULT_PAID[empType] ?? true;
    const totalDays = emp.vacation_days_per_year ?? defaultVacationDays;
    const { usedDays = 0, pendingDays = 0 } = byEmployee[emp.id] ?? {};
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      hasPaidVacation,
      totalDays,
      usedDays,
      pendingDays,
      remainingDays: Math.max(0, totalDays - usedDays),
      remainingAfterPendingDays: Math.max(0, totalDays - usedDays - pendingDays),
    };
  });

  return NextResponse.json({ balances });
}
