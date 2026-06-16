import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/work-plans/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Nepřihlášený uživatel.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profil nenalezen.' }, { status: 404 });
  }

  const { id } = params;

  // Verify the work plan belongs to the org and is active
  const { data: existing, error: fetchError } = await supabase
    .from('work_plans')
    .select('id, organization_id')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .eq('active', true)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Pracovní plán nenalezen.' }, { status: 404 });
  }

  let body: {
    date?: string;
    work_type?: string;
    start_time?: string;
    end_time?: string;
    note?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Neplatné tělo požadavku.' }, { status: 400 });
  }

  const { date, work_type, start_time, end_time, note } = body;

  if (!date || !work_type) {
    return NextResponse.json(
      { error: 'Pole date a work_type jsou povinná.' },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Datum musí být ve formátu YYYY-MM-DD.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('work_plans')
    .update({
      date,
      work_type: work_type.trim(),
      start_time: start_time !== undefined ? String(start_time).trim() : null,
      end_time: end_time !== undefined ? String(end_time).trim() : null,
      note: note !== undefined ? String(note).trim() : null,
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select()
    .single();

  if (error) {
    console.error('work_plans PUT error:', error);
    return NextResponse.json({ error: 'Nepodařilo se upravit pracovní plán.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'Pracovní plán byl upraven.', data });
}

// DELETE /api/work-plans/[id]  — soft delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Nepřihlášený uživatel.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profil nenalezen.' }, { status: 404 });
  }

  const { id } = params;

  // Verify the work plan exists and belongs to the org
  const { data: existing, error: fetchError } = await supabase
    .from('work_plans')
    .select('id, organization_id, active')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Pracovní plán nenalezen.' }, { status: 404 });
  }

  if (!existing.active) {
    return NextResponse.json({ error: 'Pracovní plán již byl smazán.' }, { status: 409 });
  }

  const { error } = await supabase
    .from('work_plans')
    .update({ active: false })
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) {
    console.error('work_plans DELETE error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat pracovní plán.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'Pracovní plán byl odstraněn.' });
}
