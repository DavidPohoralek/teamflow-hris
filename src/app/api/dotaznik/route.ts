import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('organization_id')
    .eq('email', 'info@helveti.cz')
    .maybeSingle();

  if (!profile?.organization_id) {
    return NextResponse.json({ names: [] });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employees } = await (supabase as any)
    .from('employees')
    .select('name')
    .eq('organization_id', profile.organization_id)
    .eq('active', true)
    .order('name', { ascending: true });

  const names = (employees ?? []).map((e: { name: string }) => e.name);
  return NextResponse.json({ names });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    pin: string;
    email?: string;
    department?: string;
    position?: string;
    labelProdejna: boolean;
    targetHours: number;
    contract: string;
    tier: string;
    maxSaturdays?: number;
    canWorkSaturday: boolean;
  };

  const { name, pin, email, department, position, labelProdejna, targetHours, contract, tier, maxSaturdays, canWorkSaturday } = body;

  if (!name?.trim() || !pin || pin.length < 4) {
    return NextResponse.json({ error: 'Jméno a PIN jsou povinné.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Find org for info@helveti.cz
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('organization_id')
    .eq('email', 'info@helveti.cz')
    .maybeSingle();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Organizace nenalezena.' }, { status: 500 });
  }

  const orgId = profile.organization_id;

  // Find existing employee by name within org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee } = await (supabase as any)
    .from('employees')
    .select('id, name, pin_code')
    .eq('organization_id', orgId)
    .ilike('name', name.trim())
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: `Zaměstnanec "${name.trim()}" nebyl nalezen. Zkontrolujte jméno.` }, { status: 404 });
  }

  // Check PIN uniqueness — allow reuse of own current PIN
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pinConflict } = await (supabase as any)
    .from('employees')
    .select('id, name')
    .eq('organization_id', orgId)
    .or(`pin_code.eq.${pin},pin.eq.${pin}`)
    .neq('id', employee.id)
    .maybeSingle();

  if (pinConflict) {
    return NextResponse.json({ error: `PIN ${pin} je již použit jiným zaměstnancem. Zvolte jiný.` }, { status: 409 });
  }

  const labels: string[] = [];
  if (labelProdejna) labels.push('Prodejna');

  const tierNum = tier === 'Tier 1' ? 1 : tier === 'Tier 2' ? 2 : tier === 'Tier 3' ? 3 : 0;

  // UPDATE existing employee
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('employees')
    .update({
      pin_code: pin,
      pin: pin,
      email: email?.trim() || null,
      department: department || null,
      position: position?.trim() || null,
      labels,
      target_hours: targetHours || 160,
      contract_type: contract || 'HPP',
      tier: tierNum,
      max_saturdays: tierNum > 0 ? (maxSaturdays ?? 0) : 0,
      can_work_saturday: tierNum > 0 ? canWorkSaturday : false,
    })
    .eq('id', employee.id);

  if (error) {
    console.error('dotaznik update error:', error);
    return NextResponse.json({ error: 'Nepodařilo se uložit. Zkuste to znovu.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
