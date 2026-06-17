import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

  // Fetch the request — must belong to the same org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existing, error: fetchError } = await sb
    .from('requests')
    .select('id, type, status, organization_id, employee_id, date_from, note')
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
    const noteText: string = existing.note ?? '';
    // Parse "Příchod: HH:MM – Odchod: HH:MM" from note
    const match = noteText.match(/Příchod:\s*(\d{2}:\d{2})\s*[–-]\s*Odchod:\s*(\d{2}:\d{2})/);
    if (match) {
      const [, timeIn, timeOut] = match;
      const date: string = existing.date_from; // YYYY-MM-DD
      // Store as ISO 8601 with explicit seconds — analytics uses new Date() to parse
      const checkIn = new Date(`${date}T${timeIn}:00`).toISOString();
      const checkOut = new Date(`${date}T${timeOut}:00`).toISOString();

      // Use service role to bypass RLS on attendance_logs
      const svc = getServiceClient();
      const { error: logError } = await svc.from('attendance_logs').insert({
        organization_id: orgId,
        employee_id: existing.employee_id,
        date,
        check_in: checkIn,
        check_out: checkOut,
        note: 'Oprava docházky (schváleno)',
      });

      if (logError) {
        console.error('Correction: failed to create attendance_log:', logError);
      }
    }
  }

  return NextResponse.json({ request: updated });
}
