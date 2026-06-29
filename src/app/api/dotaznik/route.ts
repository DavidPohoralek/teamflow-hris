import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

  // Check PIN uniqueness within org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('employees')
    .select('id, name')
    .eq('organization_id', orgId)
    .or(`pin_code.eq.${pin},pin.eq.${pin}`)
    .eq('active', true)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `PIN ${pin} je již používán (${existing.name}). Zvolte jiný.` }, { status: 409 });
  }

  // Build labels
  const labels: string[] = [];
  if (labelProdejna) labels.push('Prodejna');

  // Build extra data for assistant (tier, saturdays)
  const tierNum = tier === 'Tier 1' ? 1 : tier === 'Tier 2' ? 2 : tier === 'Tier 3' ? 3 : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('employees')
    .insert({
      organization_id: orgId,
      name: name.trim(),
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
      active: true,
    });

  if (error) {
    console.error('dotaznik insert error:', error);
    return NextResponse.json({ error: 'Nepodařilo se uložit. Zkuste to znovu.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
