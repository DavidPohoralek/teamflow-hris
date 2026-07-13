import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

async function notifyManager(sb: SupabaseClient, offer: { org_id: string; employee_id: string; date: string; work_type?: string | null }, result: 'accepted' | 'declined') {
  try {
    const { data: emp } = await sb.from('employees').select('name').eq('id', offer.employee_id).maybeSingle();
    const employeeName = emp?.name ?? 'Zaměstnanec';
    const action = result === 'accepted' ? 'přijal/a' : 'odmítl/a';
    const icon = result === 'accepted' ? '✅' : '❌';

    await sb.from('notifications').insert({
      organization_id: offer.org_id,
      type: `shift_${result}`,
      title: `${icon} Směna ${result === 'accepted' ? 'přijata' : 'odmítnuta'}`,
      message: `${employeeName} ${action} směnu na ${offer.date}${offer.work_type ? ` (${offer.work_type})` : ''}.`,
      read: false,
    });
  } catch {
    // Non-critical
  }
}

// Public endpoint — no manager auth needed, only the token is the secret
function getServiceSupabase() {
  return createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET /api/shift-offers/[token] — fetch offer details for the confirmation page
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from('shift_offers')
    .select(`
      id, status, date, draft_label, work_type, notes, expires_at,
      employee_id,
      employees ( name ),
      organizations ( name )
    `)
    .eq('token', params.token)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    await sb.from('shift_offers').update({ status: 'expired' }).eq('token', params.token).eq('status', 'pending');
    return NextResponse.json({ error: 'Platnost nabídky vypršela.' }, { status: 410 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emp = (data as any).employees;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = (data as any).organizations;

  return NextResponse.json({
    status:       data.status,
    date:         data.date,
    draftLabel:   data.draft_label,
    workType:     data.work_type,
    notes:        data.notes,
    expiresAt:    data.expires_at,
    employeeName: emp?.name ?? '',
    orgName:      org?.name ?? '',
  });
}

// POST /api/shift-offers/[token] — confirm or decline
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = getServiceSupabase();

  let body: { action: 'accept' | 'decline' };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (body.action !== 'accept' && body.action !== 'decline') {
    return NextResponse.json({ error: 'Neplatná akce.' }, { status: 400 });
  }

  // Load offer
  const { data: offer, error } = await sb
    .from('shift_offers')
    .select('id, status, org_id, employee_id, date, draft_label, work_type, notes, expires_at')
    .eq('token', params.token)
    .maybeSingle();

  if (error || !offer) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
  if (offer.status !== 'pending') {
    return NextResponse.json({
      error: offer.status === 'accepted'
        ? 'Nabídka již byla přijata.'
        : offer.status === 'declined'
        ? 'Nabídka již byla odmítnuta.'
        : 'Platnost nabídky vypršela.',
    }, { status: 409 });
  }
  if (offer.expires_at && new Date(offer.expires_at) < new Date()) {
    await sb.from('shift_offers').update({ status: 'expired' }).eq('id', offer.id);
    return NextResponse.json({ error: 'Platnost nabídky vypršela.' }, { status: 410 });
  }

  if (body.action === 'decline') {
    await sb.from('shift_offers').update({ status: 'declined', confirmed_at: new Date().toISOString() }).eq('id', offer.id);
    await notifyManager(sb, offer, 'declined');
    return NextResponse.json({ ok: true, result: 'declined' });
  }

  // Accept — write to work_plans (idempotent by org+employee+date)
  const { data: existing } = await sb
    .from('work_plans')
    .select('id')
    .eq('organization_id', offer.org_id)
    .eq('employee_id', offer.employee_id)
    .eq('date', offer.date)
    .maybeSingle();

  if (!existing) {
    const { error: insertErr } = await sb.from('work_plans').insert({
      organization_id: offer.org_id,
      employee_id:     offer.employee_id,
      date:            offer.date,
      work_type:       offer.work_type ?? 'Prodejna',
      notes:           offer.notes ?? 'Přijato zaměstnancem',
      active:          true,
    });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await sb.from('shift_offers').update({ status: 'accepted', confirmed_at: new Date().toISOString() }).eq('id', offer.id);

  // Notify manager via email
  await notifyManager(sb, offer, 'accepted');

  return NextResponse.json({ ok: true, result: 'accepted' });
}
