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

  // ── License gate ──────────────────────────────────────────────────────────
  const dlcToken = await getOrgDlcToken(supabase, orgId);
  if (!dlcToken) {
    return NextResponse.json(
      { error: 'Asistent směn není aktivován.', licensed: false },
      { status: 403 },
    );
  }

  let body: { month?: string; draft?: string; suggestionIds?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { month, draft = 'A', suggestionIds = [], suggestionTimes = {} } = body as typeof body & { suggestionTimes?: Record<string, { startTime: string; endTime: string }> };
  if (!month) return NextResponse.json({ error: 'Chybí month' }, { status: 422 });
  if (!suggestionIds.length) return NextResponse.json({ applied: 0, skipped: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Each suggestionId = "YYYY-MM-DD__EMPID" or "YYYY-MM-DD__EMPID__CLOSING"
  const applied: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  // Load employees for name lookup
  const { data: employees } = await sb
    .from('employees').select('id, name').eq('organization_id', orgId).eq('active', true);
  const empById: Record<string, string> = {};
  for (const e of employees ?? []) empById[e.id] = e.name;

  for (const id of suggestionIds) {
    const parts = id.split('__');
    const date   = parts[0];
    const empId  = parts[1];

    if (!date || !empId) {
      skipped.push({ id, reason: 'Neplatné ID návrhu' });
      continue;
    }

    const empName = empById[empId];
    if (!empName) {
      skipped.push({ id, reason: `Zaměstnanec ${empId} nenalezen` });
      continue;
    }

    // Check if already has any active shift on this date (idempotent)
    const { data: existing } = await sb
      .from('work_plans')
      .select('id')
      .eq('organization_id', orgId)
      .eq('employee_id', empId)
      .eq('date', date)
      .eq('active', true)
      .maybeSingle();

    if (existing) {
      skipped.push({ id, reason: `${empName} již má směnu ${date}` });
      continue;
    }

    const times = (suggestionTimes as Record<string, { startTime: string; endTime: string }>)[id] ?? {};
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
      skipped.push({ id, reason: error.message });
    } else {
      applied.push(id);
    }
  }

  return NextResponse.json({ applied: applied.length, skipped });
}
