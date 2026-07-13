import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId, userEmail, companyName, firstName, lastName } = await req.json();

  if (!userId || !companyName) {
    return NextResponse.json({ error: 'Chybí povinné údaje.' }, { status: 400 });
  }

  // Service role client bypasses RLS — safe only on server
  const supabaseAdmin = createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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

  return NextResponse.json({ ok: true, organizationId: org.id });
}
