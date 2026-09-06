import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Service role client bypasses RLS — safe only on server
function adminClient() {
  return createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Registration is invite-only: the code must exist in registration_codes and not
// have been used yet. Fails CLOSED — any lookup problem means "not valid", so a
// missing table or a DB hiccup can never accidentally open registration up.
// A code is also bound to the e-mail it was issued for, so a forwarded code
// can't be redeemed by someone else. A NULL e-mail on the row means "any".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findUnusedCode(sb: any, code: string, email: string): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const { data, error } = await sb
    .from('registration_codes')
    .select('code, used_at, email')
    .eq('code', normalized)
    .maybeSingle();
  if (error || !data || data.used_at) return null;
  if (data.email && data.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  return data.code as string;
}

// GET /api/register?code=XXXX
// Lightweight check the form runs BEFORE creating the auth user, so a wrong code
// doesn't leave an orphaned account that blocks a retry with the same e-mail.
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const code = params.get('code') ?? '';
  const email = params.get('email') ?? '';
  const valid = await findUnusedCode(adminClient(), code, email);
  return NextResponse.json({ ok: Boolean(valid) });
}

export async function POST(req: NextRequest) {
  const { userId, userEmail, companyName, firstName, lastName, code } = await req.json();

  if (!userId || !companyName) {
    return NextResponse.json({ error: 'Chybí povinné údaje.' }, { status: 400 });
  }

  const supabaseAdmin = adminClient();

  // Invite gate — before anything is created.
  const validCode = await findUnusedCode(supabaseAdmin, code ?? '', userEmail ?? '');
  if (!validCode) {
    return NextResponse.json(
      { error: 'Neplatný nebo již použitý přístupový kód, nebo nepatří k této e-mailové adrese.' },
      { status: 403 }
    );
  }

  // Create organization
  const slug = companyName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({ name: companyName, slug: `${slug}-${Date.now()}` })
    .select()
    .single();

  if (orgError) {
    console.error('Org error:', orgError);
    return NextResponse.json(
      { error: 'Nepodařilo se vytvořit organizaci: ' + orgError.message },
      { status: 500 }
    );
  }

  // Upsert profile (creates if not exists, updates if exists)
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      email: userEmail || '',
      organization_id: org.id,
      first_name: firstName || null,
      last_name: lastName || null,
      role: 'owner',
    }, { onConflict: 'id' });

  if (profileError) {
    console.error('Profile error:', profileError);
    return NextResponse.json(
      { error: 'Nepodařilo se vytvořit profil: ' + profileError.message },
      { status: 500 }
    );
  }

  // Create default company_settings row — trial status + kiosk enabled for new orgs
  await supabaseAdmin
    .from('company_settings')
    .upsert({ organization_id: org.id, kiosk_enabled: true, subscription_status: 'trial' }, { onConflict: 'organization_id' });

  // Consume the code so it can't be reused.
  await supabaseAdmin
    .from('registration_codes')
    .update({ used_at: new Date().toISOString(), used_by_org: org.id })
    .eq('code', validCode);

  return NextResponse.json({ ok: true, organizationId: org.id });
}
