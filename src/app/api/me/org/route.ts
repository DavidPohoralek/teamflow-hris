import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await (supabase as any).auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Nepřihlášený uživatel.' }, { status: 401 });
  }

  const admin = createServiceClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Organizace nenalezena.' }, { status: 404 });
  }

  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('id', profile.organization_id)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Organizace nenalezena.' }, { status: 404 });
  }

  return NextResponse.json({ id: org.id, name: org.name });
}
