import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// Lazy check: unclosed sessions from past days → one notification per employee+day.
// Runs when a manager loads notifications, so no cron is needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateUnclosedSessionNotifications(sb: any, orgId: string) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const fence = new Date();
    fence.setDate(fence.getDate() - 14);
    const fenceISO = fence.toISOString().slice(0, 10);

    const { data: openLogs } = await sb
      .from('attendance_logs')
      .select('employee_id, date, employees ( name )')
      .eq('organization_id', orgId)
      .not('check_in', 'is', null)
      .is('check_out', null)
      .lt('date', today)
      .gte('date', fenceISO);

    if (!openLogs || openLogs.length === 0) return;

    // Existing unclosed_session notifications → dedup by message
    const { data: existing } = await sb
      .from('notifications')
      .select('message')
      .eq('organization_id', orgId)
      .eq('type', 'unclosed_session')
      .gte('created_at', fence.toISOString());
    const seen = new Set(((existing ?? []) as { message: string }[]).map(n => n.message));

    const fmtDate = (d: string) => {
      const dt = new Date(d + 'T00:00:00');
      return `${dt.getDate()}. ${dt.getMonth() + 1}. ${dt.getFullYear()}`;
    };

    const inserts: Record<string, unknown>[] = [];
    const batchSeen = new Set<string>();
    for (const log of openLogs as { employee_id: string; date: string; employees: { name: string } | null }[]) {
      const name = log.employees?.name ?? 'Zaměstnanec';
      const message = `${name} se ${fmtDate(log.date)} neodhlásil/a — doplňte odchod ve Správě → Otevřené směny.`;
      if (seen.has(message) || batchSeen.has(message)) continue;
      batchSeen.add(message);
      inserts.push({
        organization_id: orgId,
        type: 'unclosed_session',
        title: '⏱️ Neodhlášená směna',
        message,
        read: false,
      });
    }
    if (inserts.length > 0) await sb.from('notifications').insert(inserts);
  } catch {
    // Non-critical — never block the notifications list
  }
}

// GET /api/notifications — list notifications for this org
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  await generateUnclosedSessionNotifications(supabase, orgId);

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

// PATCH /api/notifications — mark all as read
export async function PATCH(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('organization_id', orgId)
    .eq('read', false);

  return NextResponse.json({ ok: true });
}
