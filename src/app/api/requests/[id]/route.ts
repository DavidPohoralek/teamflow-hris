import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  vacation: 'Dovolená',
  sick: 'Nemoc',
  correction: 'Oprava docházky',
  other: 'Ostatní',
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

async function sendApprovalEmail(opts: {
  resendApiKey: string;
  emailFrom: string;
  employeeEmail: string;
  employeeName: string;
  requestType: string;
  status: 'approved' | 'rejected';
  dateFrom: string;
  dateTo?: string | null;
  managerNote?: string | null;
}) {
  const {
    resendApiKey, emailFrom, employeeEmail, employeeName,
    requestType, status, dateFrom, dateTo, managerNote,
  } = opts;

  if (!resendApiKey || !employeeEmail) return;

  const typeLabel = REQUEST_TYPE_LABELS[requestType] ?? requestType;
  const isApproved = status === 'approved';
  const statusLabel = isApproved ? 'schválena ✅' : 'zamítnuta ❌';
  const dateRange = dateTo && dateTo !== dateFrom
    ? `${formatDate(dateFrom)} – ${formatDate(dateTo)}`
    : formatDate(dateFrom);

  const firstName = employeeName.split(' ')[0];
  const subject = `Vaše žádost (${typeLabel}) byla ${isApproved ? 'schválena' : 'zamítnuta'}`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b">
      <h2 style="margin:0 0 16px;font-size:20px">Ahoj ${firstName},</h2>
      <p style="margin:0 0 12px">tvoje žádost byla <strong>${statusLabel}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr style="background:#f8fafc">
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Typ žádosti</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0">${typeLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Datum</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0">${dateRange}</td>
        </tr>
        <tr style="background:#f8fafc">
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Stav</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0">${isApproved ? '✅ Schváleno' : '❌ Zamítnuto'}</td>
        </tr>
        ${managerNote ? `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">Poznámka manažera</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${managerNote}</td></tr>` : ''}
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#64748b">Tato zpráva byla odeslána automaticky systémem TeamFlow.</p>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [employeeEmail],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('Resend email error:', err);
  }
}

// PUT /api/requests/[id]
// Body: { status: 'approved' | 'rejected', note? }
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const body = await req.json();
  const { status, note } = body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json(
      { error: 'Neplatný status. Povolené hodnoty: approved, rejected.' },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: existing, error: fetchError } = await sb
    .from('requests')
    .select('id, type, status, organization_id, employee_id, date_from, date_to, note')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Žádost nenalezena.' }, { status: 404 });
  }

  if (existing.status !== 'pending') {
    return NextResponse.json(
      { error: `Žádost již byla vyřešena (aktuální stav: ${existing.status}).` },
      { status: 409 }
    );
  }

  const resolvedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await sb
    .from('requests')
    .update({ status, note: note ?? existing.note, resolved_at: resolvedAt })
    .eq('id', params.id)
    .select()
    .single();

  if (updateError) {
    console.error('PUT /api/requests/[id] error:', updateError);
    return NextResponse.json({ error: 'Nepodařilo se aktualizovat žádost.' }, { status: 500 });
  }

  // When a correction request is approved, create an attendance_log entry
  if (status === 'approved' && existing.type === 'correction') {
    let timeIn: string | null = null;
    let timeOut: string | null = null;

    try {
      const parsed = JSON.parse(existing.note ?? '');
      timeIn = parsed.timeIn ?? null;
      timeOut = parsed.timeOut ?? null;
    } catch {
      const m = (existing.note ?? '').match(/(\d{2}:\d{2}).*?(\d{2}:\d{2})/);
      if (m) { timeIn = m[1]; timeOut = m[2]; }
    }

    if (timeIn && timeOut) {
      const date: string = existing.date_from;
      const svc = getServiceClient();
      const { error: logError } = await svc.from('attendance_logs').insert({
        organization_id: orgId,
        employee_id: existing.employee_id,
        date,
        check_in: `${date}T${timeIn}:00`,
        check_out: `${date}T${timeOut}:00`,
        note: 'Oprava docházky (schváleno)',
      });
      if (logError) {
        console.error('Correction attendance_log insert error:', logError.message, logError);
      }
    }
  }

  // When vacation approved + employee has paid vacation → create attendance_log for each vacation day
  if (status === 'approved' && existing.type === 'vacation') {
    void (async () => {
      try {
        const svc = getServiceClient();

        // Fetch employee employment_type
        const { data: emp } = await svc
          .from('employees')
          .select('employment_type')
          .eq('id', existing.employee_id)
          .eq('organization_id', orgId)
          .maybeSingle();

        // Fetch company settings
        const { data: settingsRow } = await svc
          .from('company_settings')
          .select('extra_settings')
          .eq('organization_id', orgId)
          .maybeSingle();

        const extraSettings = (settingsRow as { extra_settings?: Record<string, unknown> | null } | null)?.extra_settings ?? {};
        const configs = (extraSettings.employment_type_configs as Record<string, { paidVacation: boolean }> | undefined) ?? {};
        const DEFAULT_PAID: Record<string, boolean> = { HPP: true, DPP: true, 'DPČ': true, 'IČO': false };
        const empType = (emp as { employment_type?: string } | null)?.employment_type ?? '';
        const hasPaidVacation = configs[empType]?.paidVacation ?? DEFAULT_PAID[empType] ?? true;
        const countWeekends = (extraSettings.vacation_counting_mode as string | undefined) === 'all';

        if (!hasPaidVacation) return;

        const dateFrom = existing.date_from as string;
        const dateTo = (existing.date_to as string | null) ?? dateFrom;
        const from = new Date(dateFrom + 'T00:00:00');
        const to = new Date(dateTo + 'T00:00:00');
        const cur = new Date(from);

        while (cur <= to) {
          const dow = cur.getDay();
          if (countWeekends || (dow !== 0 && dow !== 6)) {
            const dateStr = cur.toISOString().slice(0, 10);
            const { error: logError } = await svc.from('attendance_logs').insert({
              organization_id: orgId,
              employee_id: existing.employee_id,
              date: dateStr,
              check_in: `${dateStr}T09:00:00`,
              check_out: `${dateStr}T17:00:00`,
              note: 'Placená dovolená',
              type: 'vacation',
            });
            if (logError) {
              console.error('Vacation attendance_log insert error:', logError.message, logError);
            }
          }
          cur.setDate(cur.getDate() + 1);
        }
      } catch (err) {
        console.error('Vacation attendance_log block error:', err);
      }
    })();
  }

  // Send email notification to employee (fire-and-forget, non-blocking)
  void (async () => {
    try {
      const svc = getServiceClient();

      // Fetch employee email + name
      const { data: emp } = await svc
        .from('employees')
        .select('email, name')
        .eq('id', existing.employee_id)
        .eq('organization_id', orgId)
        .maybeSingle();

      if (!emp?.email) return;

      // Fetch Resend API key from org_integrations
      const { data: integRows } = await svc
        .from('org_integrations')
        .select('key, value')
        .eq('org_id', orgId)
        .in('key', ['resend_api_key', 'email_from']);

      const integMap: Record<string, string> = {};
      for (const row of integRows ?? []) integMap[row.key] = row.value;

      await sendApprovalEmail({
        resendApiKey: integMap['resend_api_key'] ?? '',
        emailFrom: integMap['email_from'] ?? 'noreply@teamflow.app',
        employeeEmail: emp.email,
        employeeName: emp.name ?? '',
        requestType: existing.type,
        status,
        dateFrom: existing.date_from,
        dateTo: existing.date_to ?? null,
        managerNote: note ?? null,
      });
    } catch (err) {
      console.error('Email notification error:', err);
    }
  })();

  return NextResponse.json({ request: updated });
}
