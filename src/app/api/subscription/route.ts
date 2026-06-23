import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/subscription — returns current subscription status
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data } = await supabase
    .from('company_settings')
    .select('subscription_status')
    .eq('organization_id', orgId)
    .maybeSingle();

  const status = (data as { subscription_status?: string } | null)?.subscription_status ?? 'trial';
  return NextResponse.json({ status });
}

// PATCH /api/subscription — update subscription status
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
    .upsert({ organization_id: orgId, subscription_status: status }, { onConflict: 'organization_id' });

  return NextResponse.json({ ok: true });
}
