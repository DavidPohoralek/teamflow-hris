import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

type RouteContext = { params: { id: string } };

// GET /api/employees/[id] — fetch a single employee
export async function GET(
  req: NextRequest,
  { params }: RouteContext
) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data: employee, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single();

  if (error || !employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  return NextResponse.json({ employee });
}

// PUT /api/employees/[id] — update an employee
export async function PUT(
  req: NextRequest,
  { params }: RouteContext
) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  // Verify the employee belongs to this org before touching it
  const { data: existing, error: fetchError } = await supabase
    .from('employees')
    .select('id')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    name,
    email,
    phone,
    department,
    position,
    labels,
    tier,
    can_saturday,
    max_saturdays,
    target_hours,
    active,
    profile_id,
    pin,
    vacation_days_per_year,
    employment_type,
  } = body as Record<string, unknown>;

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return NextResponse.json(
      { error: 'name must be a non-empty string' },
      { status: 422 }
    );
  }

  // Build a partial update — only include fields that were provided in the body
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = (name as string).trim();
  if (email !== undefined) update.email = typeof email === 'string' ? email.trim() || null : null;
  if (phone !== undefined) update.phone = typeof phone === 'string' ? phone.trim() || null : null;
  if (department !== undefined)
    update.department = typeof department === 'string' ? department.trim() || null : null;
  if (position !== undefined)
    update.position = typeof position === 'string' ? position.trim() || null : null;
  if (labels !== undefined) update.labels = Array.isArray(labels) ? labels : [];
  if (tier !== undefined) update.tier = typeof tier === 'number' ? tier : 0;
  if (can_saturday !== undefined)
    update.can_saturday = typeof can_saturday === 'boolean' ? can_saturday : false;
  if (max_saturdays !== undefined)
    update.max_saturdays = typeof max_saturdays === 'number' ? max_saturdays : 0;
  if (target_hours !== undefined)
    update.target_hours = typeof target_hours === 'number' ? target_hours : 160;
  if (active !== undefined) update.active = typeof active === 'boolean' ? active : true;
  if (profile_id !== undefined)
    update.profile_id = typeof profile_id === 'string' ? profile_id : null;
  if (pin !== undefined) {
    const pinVal = typeof pin === 'string' ? pin.trim() || null : null;
    update.pin_code = pinVal;
    update.pin = pinVal;
  }
  if (vacation_days_per_year !== undefined)
    update.vacation_days_per_year = typeof vacation_days_per_year === 'number' ? vacation_days_per_year : 20;
  if (employment_type !== undefined)
    update.employment_type = typeof employment_type === 'string' ? employment_type : 'hpp';

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 422 });
  }

  const { data: employee, error } = await supabase
    .from('employees')
    .update(update)
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .select()
    .single();

  if (error) {
    console.error('[PUT /api/employees/[id]]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ employee });
}

// DELETE /api/employees/[id] — soft delete (set active = false)
export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data: employee, error } = await supabase
    .from('employees')
    .update({ active: false })
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .select('id, name, active')
    .single();

  if (error || !employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  return NextResponse.json({ employee });
}
