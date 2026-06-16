import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// PATCH /api/notifications/[id] — mark as read
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', params.id)
    .eq('organization_id', orgId);

  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications/[id] — delete notification
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  await supabase
    .from('notifications')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', orgId);

  return NextResponse.json({ ok: true });
}
