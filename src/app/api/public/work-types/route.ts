import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/public/work-types?orgId=UUID
// Public endpoint (no auth required). Returns active work types for the given org.
// Used by the kiosk page.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');

  if (!orgId) {
    return NextResponse.json(
      { error: 'Missing required parameter: orgId' },
      { status: 400 }
    );
  }

  // Use service role key to bypass RLS
  const supabase = createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: workTypes, error } = await supabase
    .from('work_types')
    .select('id, name, color, icon, category, sort_order')
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('sort_order')
    .order('name');

  if (error) {
    console.error('[GET /api/public/work-types]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workTypes });
}
