import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/employees — list all active employees for the authenticated user's org
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data: employees, error } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('[GET /api/employees]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ employees });
}

// POST /api/employees — create a new employee
export async function POST(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

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
    profile_id,
    pin,
    vacation_days_per_year,
    employment_type,
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
    target_hours: typeof target_hours === 'number' ? target_hours : 160,
    profile_id: typeof profile_id === 'string' ? profile_id : null,
    pin_code: typeof pin === 'string' ? pin.trim() || null : null,
    pin: typeof pin === 'string' ? pin.trim() || null : null,
    vacation_days_per_year: typeof vacation_days_per_year === 'number' ? vacation_days_per_year : 20,
    employment_type: typeof employment_type === 'string' ? employment_type : 'hpp',
    active: true,
  };

  const { data: employee, error } = await supabase
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
