import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/integrations — load org integration keys (values masked for display)
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('org_integrations')
    .select('key, value')
    .eq('org_id', orgId);

  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.key] = row.value;

  // Mask secrets for display — return only whether they are set
  return NextResponse.json({
    slack_webhook_url: map['slack_webhook_url'] ? maskSecret(map['slack_webhook_url']) : '',
    resend_api_key:    map['resend_api_key']    ? maskSecret(map['resend_api_key'])    : '',
    email_from:        map['email_from']        ?? '',
    slack_configured:  !!map['slack_webhook_url'],
    email_configured:  !!map['resend_api_key'],
  });
}

// POST /api/integrations — upsert one or more keys
export async function POST(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const ALLOWED_KEYS = ['slack_webhook_url', 'resend_api_key', 'email_from'];

  const upserts = Object.entries(body)
    .filter(([k, v]) => ALLOWED_KEYS.includes(k) && typeof v === 'string')
    .map(([k, v]) => ({ org_id: orgId, key: k, value: v }));

  if (!upserts.length) return NextResponse.json({ error: 'Žádná platná pole' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('org_integrations')
    .upsert(upserts, { onConflict: 'org_id,key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, saved: upserts.map(u => u.key) });
}

// DELETE /api/integrations?key=slack_webhook_url
export async function DELETE(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const key = new URL(req.url).searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'Chybí key' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('org_integrations')
    .delete()
    .eq('org_id', orgId)
    .eq('key', key);

  return NextResponse.json({ ok: true });
}

function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••';
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}
