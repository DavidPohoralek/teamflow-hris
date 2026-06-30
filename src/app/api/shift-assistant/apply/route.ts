import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

async function getOrgDlcToken(supabase: unknown, orgId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('dlc_licenses')
    .select('token, active, expires_at')
    .eq('org_id', orgId)
    .eq('dlc_key', 'shift_assistant')
    .maybeSingle();

  if (!data || !data.active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data.token as string;
}

export async function POST(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const dlcToken = await getOrgDlcToken(supabase, orgId);
  if (!dlcToken) {
    return NextResponse.json({ error: 'Asistent směn není aktivován.', licensed: false }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const suggestionIds = (body.suggestionIds as string[]) ?? [];
  const suggestionTimes = (body.suggestionTimes as Record<string, { startTime: string; endTime: string }>) ?? {};

  if (!suggestionIds.length) return NextResponse.json({ applied: 0, skipped: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const applied: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const id of suggestionIds) {
    // ID format: "YYYY-MM-DD__EMPLOYEE_UUID" or "YYYY-MM-DD__EMPLOYEE_UUID__CLOSING"
    const parts = id.split('__');
    const date  = parts[0];
    const empId = parts[1];

    if (!date || !empId) {
      skipped.push({ id, reason: `Neplatné ID: ${id}` });
      continue;
    }

    const times = suggestionTimes[id] ?? {};

    const { error } = await sb.from('work_plans').insert({
      organization_id: orgId,
      employee_id:     empId,
      date,
      work_type:       'Prodejna',
      start_time:      times.startTime ?? null,
      end_time:        times.endTime ?? null,
      note:            'Asistent směn',
      active:          true,
    });

    if (error) {
      console.error('[apply] insert error for', id, ':', error.message);
      skipped.push({ id, reason: error.message });
    } else {
      applied.push(id);
    }
  }

  return NextResponse.json({ applied: applied.length, skipped });
}
