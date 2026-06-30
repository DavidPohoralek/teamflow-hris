// GET /api/public/vacation-balance?orgId=UUID&pin=XXXX
// Returns vacation balance for the employee identified by PIN
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

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
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  const pin = searchParams.get('pin');

  if (!orgId || !pin) {
    return NextResponse.json({ error: 'Chybí orgId nebo pin.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Find employee
  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, vacation_days_per_year, employment_type')
    .eq('organization_id', orgId)
    .or(`pin_code.eq.${pin},pin.eq.${pin}`)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: 'Zaměstnanec nenalezen.' }, { status: 404 });
  }

  // Check if this employment type has paid vacation
  const { data: settings } = await supabase
    .from('company_settings')
    .select('extra_settings')
    .eq('organization_id', orgId)
    .maybeSingle();

  const extraSettings = (settings as { extra_settings?: Record<string, unknown> | null } | null)?.extra_settings ?? {};
  const configs = (extraSettings.employment_type_configs as Record<string, { paidVacation: boolean }> | undefined) ?? {};
  const countWeekends = (extraSettings.vacation_counting_mode as string | undefined) === 'all';
  const DEFAULT_PAID: Record<string, boolean> = { HPP: true, DPP: true, 'DPČ': true, 'IČO': false };
  const empType = employee.employment_type ?? '';
  const hasPaidVacation = configs[empType]?.paidVacation ?? DEFAULT_PAID[empType] ?? true;

  if (!hasPaidVacation) {
    return NextResponse.json({
      hasPaidVacation: false,
      totalDays: 0,
      totalHours: 0,
      usedDays: 0,
      usedHours: 0,
      pendingDays: 0,
      pendingHours: 0,
      remainingDays: 0,
      remainingHours: 0,
    });
  }

  const totalDays = employee.vacation_days_per_year ?? 20;
  const hoursPerDay = 8;
  const totalHours = totalDays * hoursPerDay;
  const currentYear = new Date().getFullYear();

  // Load vacation requests for current year
  const { data: requests } = await supabase
    .from('requests')
    .select('date_from, date_to, status')
    .eq('organization_id', orgId)
    .eq('employee_id', employee.id)
    .eq('type', 'vacation')
    .gte('date_from', `${currentYear}-01-01`)
    .lte('date_from', `${currentYear}-12-31`);

  let usedDays = 0;
  let pendingDays = 0;

  for (const req of requests ?? []) {
    const days = countVacationDays(req.date_from, req.date_to ?? null, countWeekends);
    if (req.status === 'approved') usedDays += days;
    else if (req.status === 'pending') pendingDays += days;
  }

  const remainingDays = Math.max(0, totalDays - usedDays);

  return NextResponse.json({
    hasPaidVacation: true,
    totalDays,
    totalHours,
    usedDays,
    usedHours: usedDays * hoursPerDay,
    pendingDays,
    pendingHours: pendingDays * hoursPerDay,
    remainingDays,
    remainingHours: remainingDays * hoursPerDay,
    remainingAfterPendingDays: Math.max(0, totalDays - usedDays - pendingDays),
    remainingAfterPendingHours: Math.max(0, totalDays - usedDays - pendingDays) * hoursPerDay,
  });
}
