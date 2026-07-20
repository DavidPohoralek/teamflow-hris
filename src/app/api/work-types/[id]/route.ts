import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

type RouteContext = { params: { id: string } };

// PUT /api/work-types/[id] — update a work type
export async function PUT(
  req: NextRequest,
  { params }: RouteContext
) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  // Verify the work type belongs to this org
  const { data: existing, error: fetchError } = await supabase
    .from('work_types')
    .select('id')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Work type not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, color, icon, category, sort_order, active, benefit_key } = body as Record<string, unknown>;

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return NextResponse.json(
      { error: 'name must be a non-empty string' },
      { status: 422 }
    );
  }

  const validCategories = ['shift', 'presence', 'absence', 'activity'];
  if (category !== undefined && category !== null && !validCategories.includes(category as string)) {
    return NextResponse.json(
      { error: `category must be one of: ${validCategories.join(', ')}` },
      { status: 422 }
    );
  }

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = (name as string).trim();
  if (color !== undefined) update.color = typeof color === 'string' ? color.trim() || '#3b82f6' : '#3b82f6';
  if (icon !== undefined) update.icon = typeof icon === 'string' ? icon.trim() || null : null;
  if (category !== undefined) update.category = category ?? null;
  if (sort_order !== undefined) update.sort_order = typeof sort_order === 'number' ? sort_order : 0;
  if (active !== undefined) update.active = typeof active === 'boolean' ? active : true;
  if (benefit_key !== undefined) update.benefit_key = typeof benefit_key === 'string' && benefit_key ? benefit_key : null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 422 });
  }

  const { data: workType, error } = await supabase
    .from('work_types')
    .update(update)
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .select()
    .single();

  if (error) {
    console.error('[PUT /api/work-types/[id]]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workType });
}

// DELETE /api/work-types/[id] — soft delete (set active = false)
export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data: workType, error } = await supabase
    .from('work_types')
    .update({ active: false })
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .select('id, name, active')
    .single();

  if (error || !workType) {
    return NextResponse.json({ error: 'Work type not found' }, { status: 404 });
  }

  return NextResponse.json({ workType });
}
