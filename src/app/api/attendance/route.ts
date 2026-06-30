import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/attendance?date=YYYY-MM-DD
// GET /api/attendance?month=YYYY-MM
// GET /api/attendance?employee_id=UUID&month=YYYY-MM
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');       // YYYY-MM-DD
  const month = searchParams.get('month');     // YYYY-MM
  const employeeId = searchParams.get('employee_id');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('attendance_logs')
    .select('*, employees(name)')
    .eq('organization_id', orgId)
    .order('date', { ascending: false })
    .order('check_in', { ascending: true });

  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }

  if (date) {
    query = query.eq('date', date);
  } else if (month) {
    const [year, mon] = month.split('-').map(Number);
    const firstDay = `${month}-01`;
    const lastDay = new Date(year, mon, 0).toISOString().slice(0, 10);
    query = query.gte('date', firstDay).lte('date', lastDay);
  }

  const { data, error } = await query;

  if (error) {
    console.error('GET attendance error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Supabase returns joined table as `employees` (plural) — remap to `employee` (singular) expected by client
  const mapped = (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    employee: row.employees ?? { id: row.employee_id, name: '—' },
  }));

  return NextResponse.json({ data: mapped });
}

// POST /api/attendance
// Body: { employee_id, date, check_in, check_out?, note? }
export async function POST(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  let body: {
    employee_id?: string;
    date?: string;
    check_in?: string;
    check_out?: string;
    note?: string;
    work_type_id?: string;
    work_type_name?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Neplatné tělo požadavku.' }, { status: 400 });
  }

  const { employee_id, date, check_in, check_out, note, work_type_id, work_type_name } = body;

  if (!employee_id || !date) {
    return NextResponse.json(
      { error: 'Chybí povinné pole: employee_id nebo date.' },
      { status: 400 }
    );
  }

  // Verify the employee belongs to the same organization
  const { data: empCheck, error: empError } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employee_id)
    .eq('organization_id', orgId)
    .single();

  if (empError || !empCheck) {
    return NextResponse.json(
      { error: 'Zaměstnanec nepatří do této organizace.' },
      { status: 403 }
    );
  }

  const record = {
    organization_id: orgId,
    employee_id,
    date,
    check_in: check_in ?? new Date().toISOString(),
    ...(check_out !== undefined && { check_out }),
    ...(note !== undefined && { note }),
    ...(work_type_id !== undefined && { work_type_id }),
    ...(work_type_name !== undefined && { work_type_name }),
  };

  const { data, error } = await supabase
    .from('attendance_logs')
    .insert(record)
    .select('*, employees(name)')
    .single();

  if (error) {
    console.error('POST attendance error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
