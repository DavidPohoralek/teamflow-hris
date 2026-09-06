import { NextRequest, NextResponse } from 'next/server';
import { pragueToday, toISODateLocal, VACATION_LOG_NOTE, MANUAL_VACATION_NOTE } from '@/lib/vacationDays';
import { resolveOrgId } from '@/lib/resolveOrg';
import { fetchAllRows } from '@/lib/fetchAllRows';

// GET /api/attendance?date=YYYY-MM-DD
// GET /api/attendance?month=YYYY-MM
// GET /api/attendance?employee_id=UUID&month=YYYY-MM
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase, departments } = resolved;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');       // YYYY-MM-DD
  const month = searchParams.get('month');     // YYYY-MM
  const employeeId = searchParams.get('employee_id');

  // Resolve scoped employee IDs for managers with department restrictions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let allowedEmployeeIds: string[] | null = null;
  if (departments && departments.length > 0) {
    const { data: scopedEmps } = await sb
      .from('employees')
      .select('id')
      .eq('organization_id', orgId)
      .eq('active', true)
      .in('department', departments);
    allowedEmployeeIds = (scopedEmps ?? []).map((e: { id: string }) => e.id);
  }

  let query = sb
    .from('attendance_logs')
    .select('id, employee_id, date, check_in, check_out, note, work_type_name, work_type_id, employees(id, name)')
    .eq('organization_id', orgId)
    .order('date', { ascending: false })
    .order('check_in', { ascending: true });

  if (allowedEmployeeIds !== null) {
    query = query.in('employee_id', allowedEmployeeIds.length > 0 ? allowedEmployeeIds : ['__none__']);
  }

  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }

  if (date) {
    query = query.eq('date', date);
  } else if (month) {
    const [year, mon] = month.split('-').map(Number);
    const firstDay = `${month}-01`;
    const lastDay = toISODateLocal(new Date(year, mon, 0));
    query = query.gte('date', firstDay).lte('date', lastDay);
  } else {
    // Fallback: bez parametrů vrátí jen dnešek aby nevylila celá historie
    query = query.eq('date', pragueToday());
  }

  // Paginated — an org-wide month can exceed the 1000-row PostgREST cap,
  // which would silently drop the oldest days from the attendance overview.
  let data: Record<string, unknown>[];
  try {
    data = await fetchAllRows<Record<string, unknown>>((from, to) => query.range(from, to));
  } catch (error) {
    console.error('GET attendance error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst docházku.' }, { status: 500 });
  }

  // Supabase returns joined table as `employees` (plural) — remap to `employee` (singular) expected by client
  const mapped = data.map((row: Record<string, unknown>) => ({
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

  // Marking a day as vacation by hand here used to produce a log with no request
  // behind it: Docházka showed the vacation, the balance never charged it. Give
  // it a request so the two sides agree — and so deleting either removes both.
  let vacationRequestId: string | null = null;
  let createdRequestId: string | null = null;
  if (note === VACATION_LOG_NOTE) {
    // Refuse a second vacation day on a date that already has one — otherwise
    // Docházka shows 16 h of vacation while the balance charges a single day.
    // (The approval path guards the same way via its daysWithLog set.)
    const { data: sameDay } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('organization_id', orgId)
      .eq('employee_id', employee_id)
      .eq('date', date)
      .eq('note', VACATION_LOG_NOTE)
      .limit(1)
      .maybeSingle();

    if (sameDay) {
      return NextResponse.json(
        { error: 'Tento den už je označený jako dovolená.' },
        { status: 409 }
      );
    }

    // A request already covering this day. date_to is nullable, so the overlap
    // cannot be expressed as a single filter — narrow in SQL, match in JS.
    // Pending counts too: approving it later would otherwise add a second day.
    const yearStart = `${date.slice(0, 4)}-01-01`;
    const { data: existingReqs } = await supabase
      .from('requests')
      .select('id, date_from, date_to, status')
      .eq('organization_id', orgId)
      .eq('employee_id', employee_id)
      .eq('type', 'vacation')
      .in('status', ['approved', 'pending'])
      .gte('date_from', yearStart)
      .lte('date_from', date);

    const match = (existingReqs ?? []).find((r: { date_from: string; date_to: string | null }) =>
      date >= r.date_from && date <= (r.date_to ?? r.date_from));

    if (match) {
      vacationRequestId = (match as { id: string }).id;
    } else {
      const { data: created, error: reqError } = await supabase
        .from('requests')
        .insert({
          organization_id: orgId,
          employee_id,
          type: 'vacation',
          status: 'approved',
          date_from: date,
          date_to: date,
          note: MANUAL_VACATION_NOTE,
        })
        .select('id')
        .single();
      if (reqError) {
        console.error('POST attendance: vacation request create failed:', reqError.message);
      } else {
        vacationRequestId = (created as { id: string }).id;
        createdRequestId = vacationRequestId;
      }
    }
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
    ...(vacationRequestId && { request_id: vacationRequestId }),
  };

  const { data, error } = await supabase
    .from('attendance_logs')
    .insert(record)
    .select('*, employees(name)')
    .single();

  if (error) {
    console.error('POST attendance error:', error);
    // We may have just created the backing request. Without the log it would
    // charge the employee a day of vacation that nothing shows — take it back.
    if (createdRequestId) {
      await supabase.from('requests').delete().eq('id', createdRequestId).eq('organization_id', orgId);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
