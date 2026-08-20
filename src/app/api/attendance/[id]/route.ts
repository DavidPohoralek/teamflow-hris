import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import { VACATION_LOG_NOTE } from '@/lib/vacationDays';

// Shift an ISO date (YYYY-MM-DD) by a whole number of calendar days.
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// A vacation lives as BOTH an approved `requests` row (drives the vacation
// balance) and one auto-inserted `attendance_logs` DOV row per day (drives
// attendance). When a manager deletes a DOV day from Attendance ("Záznamy"),
// trim the underlying request so it no longer covers that date — otherwise the
// balance keeps counting a day that is no longer in attendance (half-delete).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function trimVacationRequestForDate(supabase: any, orgId: string, employeeId: string, date: string) {
  const { data: reqs } = await supabase
    .from('requests')
    .select('id, date_from, date_to, status, note')
    .eq('organization_id', orgId)
    .eq('employee_id', employeeId)
    .eq('type', 'vacation')
    .eq('status', 'approved')
    .lte('date_from', date);

  for (const r of (reqs ?? []) as { id: string; date_from: string; date_to: string | null; note: string | null }[]) {
    const from = r.date_from;
    const to = r.date_to ?? r.date_from;
    if (date < from || date > to) continue; // request doesn't cover this day

    if (from === to) {
      // Single-day vacation → the whole request is this day: remove it.
      await supabase.from('requests').delete().eq('id', r.id).eq('organization_id', orgId);
    } else if (date === from) {
      await supabase.from('requests').update({ date_from: addDays(date, 1) }).eq('id', r.id).eq('organization_id', orgId);
    } else if (date === to) {
      await supabase.from('requests').update({ date_to: addDays(date, -1) }).eq('id', r.id).eq('organization_id', orgId);
    } else {
      // Middle day → split into the part before and the part after the gap.
      await supabase.from('requests').update({ date_to: addDays(date, -1) }).eq('id', r.id).eq('organization_id', orgId);
      await supabase.from('requests').insert({
        organization_id: orgId,
        employee_id: employeeId,
        type: 'vacation',
        status: 'approved',
        date_from: addDays(date, 1),
        date_to: to,
        note: r.note ?? null,
      });
    }
  }
}

// PUT /api/attendance/:id
// Body: { check_out?, note?, check_in? }
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;
  const { id } = params;

  // Fetch the existing log and verify org ownership
  const { data: existing, error: fetchError } = await supabase
    .from('attendance_logs')
    .select('id, employee_id, organization_id, check_in, check_out, note')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single() as { data: { id: string; employee_id: string; organization_id: string; check_in: string | null; check_out: string | null; note: string | null } | null; error: unknown };

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Záznam nenalezen.' }, { status: 404 });
  }

  let body: {
    check_out?: string;
    note?: string;
    check_in?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Neplatné tělo požadavku.' }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};

  if (body.check_out !== undefined) {
    updates.check_out = body.check_out;
  }

  if (body.note !== undefined) {
    updates.note = body.note;
  }

  if (body.check_in !== undefined) {
    updates.check_in = body.check_in;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'Žádné platné pole pro aktualizaci.' },
      { status: 400 }
    );
  }

  // Basic consistency check: check_out must be after check_in
  const finalCheckIn = updates.check_in ?? existing.check_in;
  const finalCheckOut = updates.check_out ?? existing.check_out;

  if (finalCheckIn && finalCheckOut && new Date(finalCheckOut) <= new Date(finalCheckIn)) {
    return NextResponse.json(
      { error: 'Čas odchodu musí být po času příchodu.' },
      { status: 422 }
    );
  }

  const { data, error } = await supabase
    .from('attendance_logs')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', orgId)
    .select('*, employees(name)')
    .single();

  if (error) {
    console.error('PUT attendance error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// DELETE /api/attendance/:id — manager only, removes the log entirely
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data, error } = await supabase
    .from('attendance_logs')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .select('id, employee_id, date, note')
    .maybeSingle();

  if (error) {
    console.error('DELETE attendance error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Záznam nenalezen.' }, { status: 404 });
  }

  // If this was a vacation DOV day, keep the vacation request in sync so the
  // balance reflects the removal (otherwise it's a silent half-delete).
  const deleted = data as { employee_id: string | null; date: string | null; note: string | null };
  if (deleted.note === VACATION_LOG_NOTE && deleted.employee_id && deleted.date) {
    try {
      await trimVacationRequestForDate(supabase, orgId, deleted.employee_id, deleted.date);
    } catch (e) {
      console.error('DELETE attendance: vacation request trim failed:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
