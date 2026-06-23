import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

const DEFAULT_TYPES = ['HPP', 'DPP', 'DPČ', 'IČO'];

// GET — returns array of employment type strings for this org
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data } = await supabase
    .from('company_settings')
    .select('value')
    .eq('organization_id', orgId)
    .eq('key', 'employment_types')
    .maybeSingle();

  let types = DEFAULT_TYPES;
  if (data?.value) {
    try { types = JSON.parse(data.value); } catch { /* use default */ }
  }
  return NextResponse.json({ types });
}

// PUT — body: { types: string[] }
export async function PUT(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { types } = await req.json() as { types: string[] };
  if (!Array.isArray(types) || types.length === 0) {
    return NextResponse.json({ error: 'Musí být alespoň jeden pracovní poměr.' }, { status: 400 });
  }
  const cleaned = types.map((t: string) => t.trim()).filter(Boolean);

  const { error } = await supabase
    .from('company_settings')
    .upsert({ organization_id: orgId, key: 'employment_types', value: JSON.stringify(cleaned) }, { onConflict: 'organization_id,key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, types: cleaned });
}
