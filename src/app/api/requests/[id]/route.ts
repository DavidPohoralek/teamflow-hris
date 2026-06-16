import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// PUT /api/requests/[id]
// Body: { status: 'approved' | 'rejected', note? }
// Only managers, admins, and owners may approve/reject.
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
  const { data: existing, error: fetchError } = await supabase
    .from('requests')
    .select('id, status, organization_id')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Žádost nenalezena.' }, { status: 404 });
  }

  if ((existing as { status: string }).status !== 'pending') {
    return NextResponse.json(
      { error: `Žádost již byla vyřešena (aktuální stav: ${(existing as { status: string }).status}).` },
      { status: 409 }
    );
  }

  const resolvedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('requests')
    .update({
      status,
      note: note ?? null,
      resolved_at: resolvedAt,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (updateError) {
    console.error('PUT /api/requests/[id] error:', updateError);
    return NextResponse.json({ error: 'Nepodařilo se aktualizovat žádost.' }, { status: 500 });
  }

  return NextResponse.json({ request: updated });
}
