import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

const BOT_SERVICE_URL = process.env.BOT_SERVICE_URL ?? 'http://localhost:3001';
const APP_BASE_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function getOrgDlcToken(supabase: unknown, orgId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('dlc_licenses')
    .select('token, active, expires_at')
    .eq('org_id', orgId)
    .eq('dlc_key', 'shift_assistant')
    .maybeSingle();
  if (!data || !data.active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data.token as string;
}

async function getOrgIntegrations(supabase: unknown, orgId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('org_integrations')
    .select('key, value')
    .eq('org_id', orgId);
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.key] = row.value;
  return {
    slackWebhookUrl: map['slack_webhook_url'] ?? '',
    resendApiKey:    map['resend_api_key'] ?? '',
    emailFrom:       map['email_from'] ?? 'asistent@helvetiplanovac.cz',
  };
}

export async function POST(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const dlcToken = await getOrgDlcToken(supabase, orgId);
  if (!dlcToken) {
    return NextResponse.json({ error: 'Asistent směn není aktivován.', licensed: false }, { status: 403 });
  }

  let body: {
    channel: string;
    employee: { id: string; name: string };
    shift: { date: string; dayName: string; startTime?: string; endTime?: string; notes?: string };
    customMessage?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Fetch employee email
  const { data: empData } = await sb
    .from('employees')
    .select('email')
    .eq('id', body.employee.id)
    .eq('organization_id', orgId)
    .maybeSingle();

  const employeeEmail: string = empData?.email ?? '';

  // ── Create a shift offer in DB ────────────────────────────────────────────
  const { data: offerData, error: offerErr } = await sb
    .from('shift_offers')
    .insert({
      org_id:         orgId,
      employee_id:    body.employee.id,
      employee_email: employeeEmail,
      date:           body.shift.date,
      draft_label:    'A',
      work_type:      'Prodejna',
      notes:          body.shift.notes ?? body.customMessage ?? null,
      status:         'pending',
    })
    .select('token')
    .single();

  if (offerErr || !offerData) {
    return NextResponse.json({ error: 'Nepodařilo se vytvořit nabídku směny.' }, { status: 500 });
  }

  const confirmUrl = `${APP_BASE_URL}/confirm-shift?token=${offerData.token}`;

  const integrations = await getOrgIntegrations(supabase, orgId);

  // Build message with confirmation link
  const defaultMessage = `Ahoj ${body.employee.name.split(' ')[0]}, manažer tě oslovuje ohledně směny ${body.shift.dayName} ${body.shift.date}.\n\nPro přijetí nebo odmítnutí klikni na odkaz:\n${confirmUrl}`;

  const messageWithLink = body.customMessage
    ? `${body.customMessage}\n\nPotvrdit / odmítnout směnu: ${confirmUrl}`
    : defaultMessage;

  // Call bot-service for actual sending
  const botRes = await fetch(`${BOT_SERVICE_URL}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: dlcToken,
      channel: body.channel,
      employee: {
        ...body.employee,
        email: employeeEmail,
      },
      shift: body.shift,
      integrations,
      customMessage: messageWithLink,
    }),
  });

  const data = await botRes.json();
  return NextResponse.json({
    ...data,
    offerToken: offerData.token,
    confirmUrl,
  }, { status: botRes.ok ? 200 : 207 });
}
