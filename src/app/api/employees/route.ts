import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/employees — list active employees, filtered by dept scope for scoped managers
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase, departments } = resolved;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('employees')
    .select('*')
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('name');

  if (departments && departments.length > 0) {
    query = query.in('department', departments);
  }

  const { data: employees, error } = await query;

  if (error) {
    console.error('[GET /api/employees]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ employees });
}

// POST /api/employees — create a new employee (admin only)
export async function POST(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase, isAdmin } = resolved;

  if (!isAdmin) {
    return NextResponse.json({ error: 'Pouze administrátor může vytvářet zaměstnance.' }, { status: 403 });
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
    short_long_week,
    target_hours,
    profile_id,
    pin,
    vacation_days_per_year,
    vacation_hours_offset,
    employment_type,
    is_manager,
    managed_departments,
    manager_permissions,
    hourly_rate,
  } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json(
      { error: 'name is required and must be a non-empty string' },
      { status: 422 }
    );
  }

  const insert = {
    organization_id: orgId,
    name: (name as string).trim(),
    email: typeof email === 'string' ? email.trim() || null : null,
    phone: typeof phone === 'string' ? phone.trim() || null : null,
    department: typeof department === 'string' ? department.trim() || null : null,
    position: typeof position === 'string' ? position.trim() || null : null,
    labels: Array.isArray(labels) ? (labels as string[]) : [],
    tier: typeof tier === 'number' ? tier : 0,
    can_saturday: typeof can_saturday === 'boolean' ? can_saturday : false,
    max_saturdays: typeof max_saturdays === 'number' ? max_saturdays : 0,
    short_long_week: typeof short_long_week === 'boolean' ? short_long_week : false,
    target_hours: typeof target_hours === 'number' ? target_hours : 160,
    profile_id: typeof profile_id === 'string' ? profile_id : null,
    pin_code: typeof pin === 'string' ? pin.trim() || null : null,
    vacation_days_per_year: typeof vacation_days_per_year === 'number' ? vacation_days_per_year : 20,
    vacation_hours_offset: typeof vacation_hours_offset === 'number' ? Math.max(0, vacation_hours_offset) : 0,
    employment_type: typeof employment_type === 'string' ? employment_type : 'hpp',
    is_manager: typeof is_manager === 'boolean' ? is_manager : false,
    managed_departments: Array.isArray(managed_departments) ? (managed_departments as string[]) : null,
    manager_permissions: Array.isArray(manager_permissions) ? (manager_permissions as string[]) : [],
    hourly_rate: typeof hourly_rate === 'number' ? hourly_rate : null,
    active: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee, error } = await (supabase as any)
    .from('employees')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[POST /api/employees]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ employee }, { status: 201 });
}
