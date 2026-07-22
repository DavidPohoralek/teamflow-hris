import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
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

// DELETE /api/requests/[id]
// Admin-only — permanently deletes the request.
// For approved vacations, also removes the auto-created attendance_log rows.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, isAdmin } = resolved;

  if (!isAdmin) {
    return NextResponse.json({ error: 'Pouze administrátor může mazat žádosti.' }, { status: 403 });
  }

  const svc = getServiceClient();

  const { data: existing, error: fetchError } = await svc
    .from('requests')
    .select('id, type, status, employee_id, date_from, date_to')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Žádost nenalezena.' }, { status: 404 });
  }

  // For approved vacations, remove the attendance_log rows that were auto-inserted
  if (existing.status === 'approved' && existing.type === 'vacation') {
    const dateFrom = existing.date_from as string;
    const dateTo = (existing.date_to as string | null) ?? dateFrom;
    const { error: logError } = await svc
      .from('attendance_logs')
      .delete()
      .eq('organization_id', orgId)
      .eq('employee_id', existing.employee_id)
      .eq('type', 'vacation')
      .gte('date', dateFrom)
      .lte('date', dateTo);
    if (logError) {
      console.error('DELETE vacation attendance_logs error:', logError.message);
    }
  }

  const { error: deleteError } = await svc
    .from('requests')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', orgId);

  if (deleteError) {
    console.error('DELETE /api/requests/[id] error:', deleteError);
    return NextResponse.json({ error: 'Nepodařilo se smazat žádost.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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

  // When a correction request is approved, update the linked attendance_log or insert a new one
  if (status === 'approved' && existing.type === 'correction') {
    let timeIn: string | null = null;
    let timeOut: string | null = null;
    let correctionField: 'check_in' | 'check_out' | 'both' = 'both';
    let linkedLogId: string | null = null;

    try {
      const parsed = JSON.parse(existing.note ?? '');
      timeIn = parsed.timeIn ?? null;
      timeOut = parsed.timeOut ?? null;
      correctionField = parsed.field ?? 'both';
      linkedLogId = parsed.linkedLogId ?? null;
    } catch {
      // Legacy format fallback — extract two times from plain text
      const m = (existing.note ?? '').match(/(\d{2}:\d{2}).*?(\d{2}:\d{2})/);
      if (m) { timeIn = m[1]; timeOut = m[2]; }
    }

    const date: string = existing.date_from;
    const svc = getServiceClient();

    // timeIn/timeOut may be a full UTC ISO string (new format) or legacy "HH:MM"
    const toTimestamp = (t: string | null): string | null => {
      if (!t) return null;
      return t.includes('T') ? t : `${date}T${t}:00`;
    };

    if (linkedLogId) {
      // UPDATE the specific linked log — only patch the corrected field(s)
      const patch: Record<string, string> = {};
      if ((correctionField === 'check_in' || correctionField === 'both') && timeIn) {
        patch.check_in = toTimestamp(timeIn)!;
      }
      if ((correctionField === 'check_out' || correctionField === 'both') && timeOut) {
        patch.check_out = toTimestamp(timeOut)!;
      }
      if (Object.keys(patch).length > 0) {
        const { error: logError } = await svc
          .from('attendance_logs')
          .update(patch)
          .eq('id', linkedLogId)
          .eq('organization_id', orgId)
          .eq('employee_id', existing.employee_id);
        if (logError) {
          console.error('Correction attendance_log update error:', logError.message, logError);
        }
      }
    } else if (timeIn || timeOut) {
      // No linked log — resolve which log to update.
      // For check_in corrections (from kiosk): prefer the open session (check_out IS NULL).
      // For check_out or both: use the most recent log.
      // Only fall back to INSERT when no log exists.
      const { data: existingLogs } = await svc
        .from('attendance_logs')
        .select('id, check_out')
        .eq('organization_id', orgId)
        .eq('employee_id', existing.employee_id)
        .eq('date', date)
        .order('check_in', { ascending: false });

      const logs = existingLogs ?? [];

      let targetLogId: string | null = null;
      if (logs.length === 1) {
        targetLogId = logs[0].id;
      } else if (logs.length > 1) {
        if (correctionField === 'check_in') {
          // Pick the open session (check_out IS NULL), else most recent
          const open = logs.find((l) => !l.check_out);
          targetLogId = (open ?? logs[0]).id;
        } else {
          // check_out or both — most recent log
          targetLogId = logs[0].id;
        }
      }

      if (targetLogId) {
        const patch: Record<string, string | null> = {};
        if (timeIn) patch.check_in = toTimestamp(timeIn);
        if (timeOut) patch.check_out = toTimestamp(timeOut);
        const { error: logError } = await svc
          .from('attendance_logs')
          .update(patch)
          .eq('id', targetLogId)
          .eq('organization_id', orgId)
          .eq('employee_id', existing.employee_id);
        if (logError) {
          console.error('Correction attendance_log update (no linkedId) error:', logError.message, logError);
        }
      } else if (timeIn && timeOut) {
        // 0 logs — insert a new complete record
        const { error: logError } = await svc.from('attendance_logs').insert({
          organization_id: orgId,
          employee_id: existing.employee_id,
          date,
          check_in: toTimestamp(timeIn),
          check_out: toTimestamp(timeOut),
          note: 'Oprava docházky (schváleno)',
        });
        if (logError) {
          console.error('Correction attendance_log insert error:', logError.message, logError);
        }
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
