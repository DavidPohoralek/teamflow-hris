import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/shift-assistant/license
// Returns whether the org has an active Shift Assistant license + the DLC token (server-side only)
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('dlc_licenses')
    .select('id, token, active, expires_at, purchased_at')
    .eq('org_id', orgId)
    .eq('dlc_key', 'shift_assistant')
    .maybeSingle();

  if (error) return NextResponse.json({ licensed: false, reason: 'db_error' });
  if (!data) return NextResponse.json({ licensed: false, reason: 'no_license' });
  if (!data.active) return NextResponse.json({ licensed: false, reason: 'inactive' });
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ licensed: false, reason: 'expired', expires_at: data.expires_at });
  }

  // Return token so client can pass it to analyze/apply calls
  // Token never exposed to browser — stays in Next.js server-side calls
  return NextResponse.json({
    licensed: true,
    token: data.token,
    purchased_at: data.purchased_at,
    expires_at: data.expires_at ?? null,
  });
}
