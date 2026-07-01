import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/work-plans?month=YYYY-MM
export async function GET(req: NextRequest) {
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

  const month = req.nextUrl.searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: 'Parametr month je povinný ve formátu YYYY-MM.' },
      { status: 400 }
    );
  }

  // Build date range for the month
  const [year, monthNum] = month.split('-').map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('work_plans')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('active', true)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('employee_id', { ascending: true });

  if (error) {
    console.error('work_plans GET error:', error);
    return NextResponse.json({ error: 'Chyba při načítání pracovních plánů.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/work-plans
export async function POST(req: NextRequest) {
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

  let body: {
    employee_id?: string;
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

  const { employee_id, date, work_type, start_time, end_time, note } = body;

  if (!employee_id || !date || !work_type) {
    return NextResponse.json(
      { error: 'Pole employee_id, date a work_type jsou povinná.' },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Datum musí být ve formátu YYYY-MM-DD.' },
      { status: 400 }
    );
  }

  // Verify employee belongs to the same organization
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employee_id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (empError || !employee) {
    return NextResponse.json({ error: 'Zaměstnanec nenalezen.' }, { status: 404 });
  }

  // Duplicate check: same employee + date + overlapping time
  const { data: existing } = await supabase
    .from('work_plans')
    .select('id, start_time, end_time')
    .eq('organization_id', profile.organization_id)
    .eq('employee_id', employee_id)
    .eq('date', date)
    .eq('active', true);

  if (existing?.length) {
    const newStart = start_time ?? null;
    const newEnd = end_time ?? null;
    const duplicate = existing.some((e: { start_time: string | null; end_time: string | null }) =>
      e.start_time === newStart && e.end_time === newEnd
    );
    if (duplicate) {
      return NextResponse.json({ error: 'Tato směna již existuje (stejný čas).' }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from('work_plans')
    .insert({
      organization_id: profile.organization_id,
      employee_id,
      date,
      work_type: work_type.trim(),
      start_time: start_time ? String(start_time).trim() : null,
      end_time: end_time ? String(end_time).trim() : null,
      note: note ? String(note).trim() : null,
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('work_plans POST error:', error);
    return NextResponse.json({ error: 'Nepodařilo se vytvořit pracovní plán.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
