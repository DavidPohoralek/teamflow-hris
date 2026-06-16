import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import { randomUUID } from 'crypto';

// GET /api/work-types — list all active work types for the authenticated user's org
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data: workTypes, error } = await supabase
    .from('work_types')
    .select('*')
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('sort_order')
    .order('name');

  if (error) {
    console.error('[GET /api/work-types]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workTypes });
}

// POST /api/work-types — create a new work type
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

  const { name, color, icon, category, sort_order } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json(
      { error: 'name is required and must be a non-empty string' },
      { status: 422 }
    );
  }

  const validCategories = ['shift', 'presence', 'absence'];
  if (category !== undefined && !validCategories.includes(category as string)) {
    return NextResponse.json(
      { error: `category must be one of: ${validCategories.join(', ')}` },
      { status: 422 }
    );
  }

  const insert = {
    id: randomUUID(),
    organization_id: orgId,
    name: (name as string).trim(),
    color: typeof color === 'string' && color.trim() ? color.trim() : '#3b82f6',
    icon: typeof icon === 'string' ? icon.trim() || null : null,
    category: typeof category === 'string' ? category : null,
    sort_order: typeof sort_order === 'number' ? sort_order : 0,
    active: true,
  };

  const { data: workType, error } = await supabase
    .from('work_types')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[POST /api/work-types]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workType }, { status: 201 });
}
