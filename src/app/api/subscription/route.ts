import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/subscription — returns current subscription status
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data } = await supabase
    .from('company_settings')
    .select('value')
    .eq('organization_id', orgId)
    .eq('key', 'subscription_status')
    .maybeSingle();

  const status = (data as { value?: string } | null)?.value ?? 'trial';
  return NextResponse.json({ status });
}

// PATCH /api/subscription — update subscription status (internal: pending after tour)
export async function PATCH(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { status } = await req.json() as { status: string };
  const allowed = ['trial', 'pending', 'active', 'expired'];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await supabase
    .from('company_settings')
    .upsert({ organization_id: orgId, key: 'subscription_status', value: status }, { onConflict: 'organization_id,key' });

  return NextResponse.json({ ok: true });
}
