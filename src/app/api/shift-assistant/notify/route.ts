import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

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

  // Fetch employee email + Slack member ID
  const { data: empData } = await sb
    .from('employees')
    .select('email, slack_id')
    .eq('id', body.employee.id)
    .eq('organization_id', orgId)
    .maybeSingle();

  const employeeEmail: string = empData?.email ?? '';
  const employeeSlackId: string = (empData?.slack_id ?? '').trim();

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

  // Send directly — Slack incoming webhook + Resend e-mail.
  // (Dřív šlo přes externí bot-service na Railway, ten už neexistuje.)
  const wantSlack = body.channel === 'slack' || body.channel === 'both';
  const wantEmail = body.channel === 'email' || body.channel === 'both';
  const results: { channel: string; ok: boolean; error?: string }[] = [];

  if (wantSlack) {
    if (!integrations.slackWebhookUrl) {
      results.push({ channel: 'slack', ok: false, error: 'Slack webhook není nastaven (Nastavení → Integrace).' });
    } else {
      try {
        // <@U…> pings the employee directly when their Slack member ID is filled in
        const slackAddress = employeeSlackId ? `<@${employeeSlackId}>` : body.employee.name;
        const r = await fetch(integrations.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `*Nabídka směny* — ${slackAddress}\n${messageWithLink}` }),
        });
        if (r.ok) results.push({ channel: 'slack', ok: true });
        else results.push({ channel: 'slack', ok: false, error: `Slack odmítl zprávu (${r.status}). Zkontrolujte webhook URL.` });
      } catch {
        results.push({ channel: 'slack', ok: false, error: 'Slack webhook nedostupný.' });
      }
    }
  }

  if (wantEmail) {
    if (!integrations.resendApiKey) {
      results.push({ channel: 'email', ok: false, error: 'Resend API klíč není nastaven (Nastavení → Integrace).' });
    } else if (!employeeEmail) {
      results.push({ channel: 'email', ok: false, error: 'Zaměstnanec nemá vyplněný e-mail.' });
    } else {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${integrations.resendApiKey}`,
          },
          body: JSON.stringify({
            from: integrations.emailFrom,
            to: employeeEmail,
            subject: `Nabídka směny ${body.shift.dayName} ${body.shift.date}`,
            text: messageWithLink,
          }),
        });
        if (r.ok) results.push({ channel: 'email', ok: true });
        else {
          const err = await r.json().catch(() => ({} as { message?: string }));
          results.push({ channel: 'email', ok: false, error: `E-mail se nepodařilo odeslat (${(err as { message?: string }).message ?? r.status}).` });
        }
      } catch {
        results.push({ channel: 'email', ok: false, error: 'E-mailová služba nedostupná.' });
      }
    }
  }

  const allOk = results.length > 0 && results.every((r) => r.ok);
  return NextResponse.json({
    results,
    offerToken: offerData.token,
    confirmUrl,
  }, { status: allOk ? 200 : 207 });
}
