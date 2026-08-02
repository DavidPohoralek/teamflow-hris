// GET /api/manager/vacation-balances
// Returns vacation balance for all active employees
import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import { vacationDaysInRange } from '@/lib/vacationDays';

export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const yearParam = new URL(req.url).searchParams.get('year');
  const currentYear = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : new Date().getFullYear();

  const [empsRes, requestsRes, settingsRes] = await Promise.all([
    sb.from('employees').select('id, name, vacation_days_per_year, vacation_hours_offset, employment_type').eq('organization_id', orgId).eq('active', true).order('name'),
    sb.from('requests').select('employee_id, date_from, date_to, status').eq('organization_id', orgId).eq('type', 'vacation').gte('date_from', `${currentYear}-01-01`).lte('date_from', `${currentYear}-12-31`),
    sb.from('company_settings').select('extra_settings').eq('organization_id', orgId).maybeSingle(),
  ]);

  const extraSettings = (settingsRes.data as { extra_settings?: Record<string, unknown> | null } | null)?.extra_settings ?? {};
  const configs = (extraSettings.employment_type_configs as Record<string, { paidVacation: boolean }> | undefined) ?? {};
  const countWeekends = (extraSettings.vacation_counting_mode as string | undefined) === 'all';
  const defaultVacationDays = typeof extraSettings.default_vacation_days === 'number' ? extraSettings.default_vacation_days : 20;
  const DEFAULT_PAID: Record<string, boolean> = { HPP: true, DPP: true, 'DPČ': true, 'IČO': false };

  // Group requests by employee — Sets of unique days so overlapping requests don't double-count
  const byEmployee: Record<string, { used: Set<string>; pending: Set<string> }> = {};
  for (const req of (requestsRes.data ?? [])) {
    if (!byEmployee[req.employee_id]) byEmployee[req.employee_id] = { used: new Set(), pending: new Set() };
    const target = req.status === 'approved' ? byEmployee[req.employee_id].used
      : req.status === 'pending' ? byEmployee[req.employee_id].pending
      : null;
    if (!target) continue;
    for (const iso of vacationDaysInRange(req.date_from, req.date_to ?? null, countWeekends)) target.add(iso);
  }

  const hoursPerDay = 8;
  const balances = (empsRes.data ?? []).map((emp: { id: string; name: string; vacation_days_per_year?: number; vacation_hours_offset?: number; employment_type?: string }) => {
    const empType = emp.employment_type ?? '';
    const hasPaidVacation = configs[empType]?.paidVacation ?? DEFAULT_PAID[empType] ?? true;
    const totalDays = emp.vacation_days_per_year ?? defaultVacationDays;
    const offsetHours = Number(emp.vacation_hours_offset ?? 0);
    const effectiveStartDays = offsetHours > 0 ? offsetHours / hoursPerDay : totalDays;
    const usedDays = byEmployee[emp.id]?.used.size ?? 0;
    const pendingDays = byEmployee[emp.id]?.pending.size ?? 0;
    const remainingDays = Math.max(0, effectiveStartDays - usedDays);
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      hasPaidVacation,
      totalDays,
      usedDays,
      pendingDays,
      remainingDays,
      remainingAfterPendingDays: Math.max(0, effectiveStartDays - usedDays - pendingDays),
    };
  });

  return NextResponse.json({ balances });
}
