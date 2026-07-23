import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/requests
// Query params:
//   status=pending|approved|rejected  (optional)
//   month=YYYY-MM                     (optional)
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase, departments } = resolved;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');
  const monthFilter = searchParams.get('month'); // YYYY-MM

  // If scoped manager has department restrictions, fetch allowed employee IDs first
  let allowedEmpIds: string[] | null = null;
  if (departments && departments.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deptEmps } = await (supabase as any)
      .from('employees')
      .select('id')
      .eq('organization_id', orgId)
      .in('department', departments);
    allowedEmpIds = (deptEmps ?? []).map((e: { id: string }) => e.id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('requests')
    .select(
      `
      id,
      organization_id,
      employee_id,
      type,
      date_from,
      date_to,
      note,
      hours,
      status,
      resolved_by,
      resolved_at,
      created_at,
      employees!requests_employee_id_fkey (
        id,
        name,
        department,
        position
      )
      `
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (allowedEmpIds !== null) {
    query = query.in('employee_id', allowedEmpIds);
  }

  if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
    query = query.eq('status', statusFilter);
  }

  if (monthFilter && /^\d{4}-\d{2}$/.test(monthFilter)) {
    const [year, month] = monthFilter.split('-').map(Number);
    const firstDay = `${monthFilter}-01`;
    const lastDay = new Date(year, month, 0).toISOString().slice(0, 10);
    query = query.gte('date_from', firstDay).lte('date_from', lastDay);
  } else {
    // Bez month parametru omez na posledních 13 měsíců
    const fence = new Date();
    fence.setFullYear(fence.getFullYear() - 1);
    query = query.gte('date_from', fence.toISOString().slice(0, 10));
  }

  query = query.limit(500);

  const { data, error } = await query;

  if (error) {
    console.error('GET /api/requests error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst žádosti.' }, { status: 500 });
  }

  return NextResponse.json({ requests: data });
}

// POST /api/requests
// Body: { employee_id, type, date_from, date_to?, note? }
export async function POST(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const body = await req.json();
  const { employee_id, type, date_from, date_to, note } = body;

  if (!employee_id || !type || !date_from) {
    return NextResponse.json(
      { error: 'Povinné pole chybí: employee_id, type, date_from.' },
      { status: 400 }
    );
  }

  const validTypes = ['vacation', 'sick', 'correction', 'other'];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Neplatný typ žádosti. Povolené hodnoty: ${validTypes.join(', ')}.` },
      { status: 400 }
    );
  }

  const { data: targetEmployee, error: empError } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employee_id)
    .eq('organization_id', orgId)
    .single();

  if (empError || !targetEmployee) {
    return NextResponse.json({ error: 'Zaměstnanec nenalezen.' }, { status: 404 });
  }

  const { data: newRequest, error: insertError } = await supabase
    .from('requests')
    .insert({
      organization_id: orgId,
      employee_id,
      type,
      date_from,
      date_to: date_to ?? null,
      note: note ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    console.error('POST /api/requests error:', insertError);
    return NextResponse.json({ error: 'Nepodařilo se vytvořit žádost.' }, { status: 500 });
  }

  return NextResponse.json({ request: newRequest }, { status: 201 });
}
