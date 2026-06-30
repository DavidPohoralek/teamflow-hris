import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

const DEFAULT_TYPES = ['HPP', 'DPP', 'DPČ', 'IČO'];
// By default HPP, DPP, DPČ have paid vacation; IČO does not
const DEFAULT_PAID: Record<string, boolean> = { HPP: true, DPP: true, 'DPČ': true, 'IČO': false };

// GET — returns { types: string[], configs: Record<string, {paidVacation: boolean}> }
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('company_settings')
    .select('employment_types, extra_settings')
    .eq('organization_id', orgId)
    .maybeSingle();

  const types: string[] = (data as { employment_types?: string[] | null } | null)?.employment_types ?? DEFAULT_TYPES;
  const extraSettings = (data as { extra_settings?: Record<string, unknown> | null } | null)?.extra_settings ?? {};
  const configs = (extraSettings.employment_type_configs as Record<string, { paidVacation: boolean }> | undefined) ?? {};

  // Fill defaults for types not yet configured
  const fullConfigs: Record<string, { paidVacation: boolean }> = {};
  for (const t of types) {
    fullConfigs[t] = configs[t] ?? { paidVacation: DEFAULT_PAID[t] ?? true };
  }

  return NextResponse.json({ types, configs: fullConfigs });
}

// PUT — body: { types?: string[], configs?: Record<string, {paidVacation: boolean}> }
export async function PUT(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const body = await req.json() as { types?: string[]; configs?: Record<string, { paidVacation: boolean }> };

  const updates: Record<string, unknown> = {};

  if (body.types !== undefined) {
    if (!Array.isArray(body.types) || body.types.length === 0) {
      return NextResponse.json({ error: 'Musí být alespoň jeden pracovní poměr.' }, { status: 400 });
    }
    updates.employment_types = body.types.map((t: string) => t.trim()).filter(Boolean);
  }

  if (body.configs !== undefined) {
    const { data: current } = await sb
      .from('company_settings').select('extra_settings').eq('organization_id', orgId).maybeSingle();
    const currentExtra = (current as { extra_settings?: Record<string, unknown> | null } | null)?.extra_settings ?? {};
    updates.extra_settings = { ...currentExtra, employment_type_configs: body.configs };
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

  const { error } = await sb
    .from('company_settings')
    .upsert({ organization_id: orgId, ...updates }, { onConflict: 'organization_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
