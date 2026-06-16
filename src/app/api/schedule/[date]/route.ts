import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PUT /api/schedule/[date]?draft=A
export async function PUT(
  req: NextRequest,
  { params }: { params: { date: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: 'Organizace nenalezena' }, { status: 403 });
  }

  const { date } = params;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Datum v URL musí být ve formátu YYYY-MM-DD' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const draft = searchParams.get('draft') ?? 'A';

  const body = await req.json();

  const {
    day_name,
    day_type,
    required_total,
    assigned_employees,
    assigned_count,
    status,
    notes,
  } = body;

  const organizationId = profile.organization_id;

  // Build partial update — only fields present in body
  const updatePayload: Record<string, unknown> = {};
  if (day_name !== undefined) updatePayload.day_name = day_name;
  if (day_type !== undefined) updatePayload.day_type = day_type;
  if (required_total !== undefined) updatePayload.required_total = required_total;
  if (assigned_employees !== undefined) updatePayload.assigned_employees = assigned_employees;
  if (assigned_count !== undefined) {
    updatePayload.assigned_count = assigned_count;
  } else if (Array.isArray(assigned_employees)) {
    // Auto-derive count from array length when not explicitly provided
    updatePayload.assigned_count = assigned_employees.length;
  }
  if (status !== undefined) updatePayload.status = status;
  if (notes !== undefined) updatePayload.notes = notes;

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { error: 'Žádná pole k aktualizaci' },
      { status: 400 }
    );
  }

  // Try update first; if no rows matched, upsert (create the row)
  const { data: updated, error: updateError, count } = await supabase
    .from('schedule_days')
    .update(updatePayload)
    .eq('organization_id', organizationId)
    .eq('draft', draft)
    .eq('date', date)
    .select()
    .single();

  if (updateError && updateError.code !== 'PGRST116') {
    // PGRST116 = row not found; other errors are real failures
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated) {
    // Row did not exist — insert it
    const insertPayload: Record<string, unknown> = {
      organization_id: organizationId,
      draft,
      date,
      ...updatePayload,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('schedule_days')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(inserted, { status: 201 });
  }

  return NextResponse.json(updated, { status: 200 });
}
