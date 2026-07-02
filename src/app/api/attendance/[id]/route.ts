import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

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
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('DELETE attendance error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Záznam nenalezen.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
