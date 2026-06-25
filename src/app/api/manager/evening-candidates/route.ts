import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/manager/evening-candidates?date=2026-06-25&month=2026-06
// Returns employees eligible for evening shift, ranked by:
//   1. Already scheduled on `date` (strongest candidates — just staying longer)
//   2. Monthly hours ascending (least loaded first)
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date'); // YYYY-MM-DD
  const month = searchParams.get('month') ?? (date ? date.slice(0, 7) : new Date().toISOString().slice(0, 7));

  if (!date) return NextResponse.json({ error: 'Chybí parametr date.' }, { status: 400 });

  // Load evening shift config from extra_settings
  const { data: settingsRow } = await supabase
    .from('company_settings')
    .select('extra_settings')
    .eq('organization_id', orgId)
    .maybeSingle();

  const extra = (settingsRow as { extra_settings?: Record<string, unknown> | null } | null)?.extra_settings ?? {};
  const eveningEnabled = extra.evening_shift_enabled === true || extra.evening_shift_enabled === 'true';
  const eveningLabel = typeof extra.evening_shift_label === 'string' && extra.evening_shift_label
    ? extra.evening_shift_label
    : 'Prodejna';
  const eveningStart = typeof extra.evening_shift_start === 'string' ? extra.evening_shift_start : '17:00';
  const eveningEnd = typeof extra.evening_shift_end === 'string' ? extra.evening_shift_end : '19:00';
  const minStaff = Number(extra.evening_shift_min_staff) || 2;

  // All active employees with the evening label
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, labels, target_hours, tier')
    .eq('organization_id', orgId)
    .eq('active', true)
    .contains('labels', [eveningLabel]);

  if (!employees || employees.length === 0) {
    return NextResponse.json({
      eveningEnabled,
      eveningStart,
      eveningEnd,
      minStaff,
      eveningLabel,
      candidates: [],
    });
  }

  const employeeIds = employees.map((e: { id: string }) => e.id);

  // Who is already scheduled on this date?
  const { data: todayPlans } = await supabase
    .from('work_plans')
    .select('employee_id, start_time, end_time, work_type')
    .eq('organization_id', orgId)
    .eq('date', date)
    .eq('active', true)
    .in('employee_id', employeeIds);

  const scheduledTodayIds = new Set<string>(
    (todayPlans ?? []).map((p: { employee_id: string }) => p.employee_id)
  );

  // Who already has an evening shift entry today (to avoid double-counting)?
  const eveningStartH = parseInt(eveningStart.split(':')[0]);
  const alreadyEveningIds = new Set<string>(
    (todayPlans ?? [])
      .filter((p: { start_time: string | null }) => {
        if (!p.start_time) return false;
        const h = parseInt(p.start_time.split(':')[0]);
        return h >= eveningStartH;
      })
      .map((p: { employee_id: string }) => p.employee_id)
  );

  // Monthly hours worked (from work_plans this month) — simple approximation via shift duration
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;

  const { data: monthPlans } = await supabase
    .from('work_plans')
    .select('employee_id, start_time, end_time')
    .eq('organization_id', orgId)
    .eq('active', true)
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .in('employee_id', employeeIds);

  // Sum hours per employee
  const monthlyHours = new Map<string, number>();
  for (const plan of monthPlans ?? []) {
    const p = plan as { employee_id: string; start_time: string | null; end_time: string | null };
    if (!p.start_time || !p.end_time) continue;
    const [sh, sm] = p.start_time.split(':').map(Number);
    const [eh, em] = p.end_time.split(':').map(Number);
    const hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
    if (hours > 0) {
      monthlyHours.set(p.employee_id, (monthlyHours.get(p.employee_id) ?? 0) + hours);
    }
  }

  type Emp = { id: string; name: string; labels: string[] | null; target_hours: number | null; tier: number | null };

  const candidates = (employees as Emp[])
    .filter((e) => !alreadyEveningIds.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      tier: e.tier ?? 0,
      targetHours: e.target_hours ?? 160,
      monthlyHours: Math.round((monthlyHours.get(e.id) ?? 0) * 10) / 10,
      scheduledToday: scheduledTodayIds.has(e.id),
      todayShift: scheduledTodayIds.has(e.id)
        ? (todayPlans ?? []).find((p: { employee_id: string; start_time: string | null; end_time: string | null }) => p.employee_id === e.id)
        : null,
    }))
    // Sort: scheduled today first, then by monthly hours ascending
    .sort((a, b) => {
      if (a.scheduledToday !== b.scheduledToday) return a.scheduledToday ? -1 : 1;
      return a.monthlyHours - b.monthlyHours;
    });

  return NextResponse.json({
    eveningEnabled,
    eveningStart,
    eveningEnd,
    minStaff,
    eveningLabel,
    candidates,
  });
}
