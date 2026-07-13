import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Public endpoint — no auth required, uses service role key.
// GET /api/public/schedule?orgId=UUID&month=YYYY-MM

function createServiceClient() {
  return createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  const month = searchParams.get('month');

  if (!orgId) {
    return NextResponse.json({ error: 'Parametr orgId je povinný.' }, { status: 400 });
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: 'Parametr month je povinný ve formátu YYYY-MM.' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const [year, monthNum] = month.split('-').map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;

  // Query work_plans joined with employees and work_types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawPlans, error: plansError } = await (supabase as any)
    .from('work_plans')
    .select(
      `
      id,
      date,
      employee_id,
      work_type,
      work_type_id,
      start_time,
      end_time,
      note,
      employees ( name, department ),
      work_types ( name, color )
    `
    )
    .eq('organization_id', orgId)
    .eq('active', true)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('employee_id', { ascending: true });

  if (plansError) {
    console.error('public/schedule work_plans error:', plansError);
    return NextResponse.json({ error: 'Chyba při načítání pracovních plánů.' }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workPlans = (rawPlans ?? []).map((row: any) => ({
    id: row.id,
    date: row.date,
    employeeId: row.employee_id,
    employeeName: row.employees?.name ?? null,
    employeeDepartment: row.employees?.department ?? null,
    workType: row.work_type ?? null,
    workTypeId: row.work_type_id ?? null,
    workTypeName: row.work_types?.name ?? row.work_type ?? null,
    workTypeColor: row.work_types?.color ?? null,
    startTime: row.start_time ?? null,
    endTime: row.end_time ?? null,
  }));

  // Query schedule_days for draft='A'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawDays, error: daysError } = await (supabase as any)
    .from('schedule_days')
    .select('date, day_type, required_total, assigned_count')
    .eq('organization_id', orgId)
    .eq('draft', 'A')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (daysError) {
    console.error('public/schedule schedule_days error:', daysError);
    return NextResponse.json({ error: 'Chyba při načítání rozvrhu dnů.' }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheduleDays = (rawDays ?? []).map((row: any) => ({
    date: row.date,
    dayType: row.day_type,
    requiredTotal: row.required_total,
    assignedCount: row.assigned_count,
  }));

  return NextResponse.json({ month, workPlans, scheduleDays });
}
