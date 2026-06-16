import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/schedule?month=YYYY-MM&draft=A
export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 });
  }

  // Resolve organization_id from user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: 'Organizace nenalezena' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // e.g. "2026-06"
  const draft = searchParams.get('draft') ?? 'A';

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Parametr month musí být ve formátu YYYY-MM' }, { status: 400 });
  }

  const [year, mon] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  // Last day of month
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  const organizationId = profile.organization_id;

  // Fetch schedule_days for this month + draft
  const { data: scheduleDays, error: scheduleError } = await supabase
    .from('schedule_days')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('draft', draft)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (scheduleError) {
    return NextResponse.json({ error: scheduleError.message }, { status: 500 });
  }

  // Fetch work_plans for this month to compute plannedEmployees per day
  // work_plans expected to have: employee_id, employee_name, work_date, work_type, time_from, time_to
  const { data: workPlans, error: workPlansError } = await supabase
    .from('work_plans')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('work_date', startDate)
    .lte('work_date', endDate);

  if (workPlansError) {
    return NextResponse.json({ error: workPlansError.message }, { status: 500 });
  }

  // Build a map: date -> workPlan entries that are prodejna/prodej
  const prodejPlansByDate: Record<string, { name: string; time?: string }[]> = {};
  for (const wp of workPlans ?? []) {
    const wt: string = wp.work_type ?? '';
    const isProdej =
      wt.toLowerCase().includes('prodej') ||
      wt.toLowerCase().includes('prodejna');
    if (!isProdej) continue;

    const date: string = wp.work_date;
    if (!prodejPlansByDate[date]) {
      prodejPlansByDate[date] = [];
    }
    const name: string = wp.employee_name ?? wp.employee_id ?? '';
    const time =
      wp.time_from && wp.time_to ? `${wp.time_from}–${wp.time_to}` : undefined;
    prodejPlansByDate[date].push({ name, time });
  }

  // Generate all days in month and merge with stored schedule_days
  const scheduleDayMap: Record<string, Record<string, unknown>> = {};
  for (const day of scheduleDays ?? []) {
    scheduleDayMap[day.date] = day;
  }

  const dayNames = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const jsDate = new Date(year, mon - 1, d);
    const storedDay = scheduleDayMap[dateStr];

    const plannedRaw = prodejPlansByDate[dateStr] ?? [];
    const plannedEmployees: string[] = plannedRaw.map((p) =>
      p.time ? `${p.name} (${p.time})` : p.name
    );

    days.push({
      date: dateStr,
      dayName: storedDay?.day_name ?? dayNames[jsDate.getDay()],
      dayType: storedDay?.day_type ?? 'Pracovní',
      requiredTotal: storedDay?.required_total ?? 0,
      assignedEmployees: storedDay?.assigned_employees ?? [],
      assignedCount: storedDay?.assigned_count ?? 0,
      status: storedDay?.status ?? 'open',
      notes: storedDay?.notes ?? null,
      plannedEmployees,
      // extra meta
      id: storedDay?.id ?? null,
      draft,
    });
  }

  return NextResponse.json({
    month,
    draft,
    days,
    workPlans: workPlans ?? [],
  });
}

// POST /api/schedule — upsert a schedule day
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: 'Organizace nenalezena' }, { status: 403 });
  }

  const body = await req.json();

  const {
    date,
    draft = 'A',
    day_name,
    day_type,
    required_total,
    assigned_employees,
    assigned_count,
    status,
    notes,
  } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Parametr date musí být ve formátu YYYY-MM-DD' },
      { status: 400 }
    );
  }

  const organizationId = profile.organization_id;

  const upsertPayload: Record<string, unknown> = {
    organization_id: organizationId,
    draft,
    date,
  };

  if (day_name !== undefined) upsertPayload.day_name = day_name;
  if (day_type !== undefined) upsertPayload.day_type = day_type;
  if (required_total !== undefined) upsertPayload.required_total = required_total;
  if (assigned_employees !== undefined) upsertPayload.assigned_employees = assigned_employees;
  if (assigned_count !== undefined) upsertPayload.assigned_count = assigned_count;
  if (status !== undefined) upsertPayload.status = status;
  if (notes !== undefined) upsertPayload.notes = notes;

  const { data, error } = await supabase
    .from('schedule_days')
    .upsert(upsertPayload, {
      onConflict: 'organization_id,draft,date',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
