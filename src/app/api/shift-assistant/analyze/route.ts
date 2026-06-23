import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

const BOT_SERVICE_URL = process.env.BOT_SERVICE_URL ?? 'http://localhost:3001';

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

export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  // ── License gate ──────────────────────────────────────────────────────────
  const dlcToken = await getOrgDlcToken(supabase, orgId);
  if (!dlcToken) {
    return NextResponse.json(
      { error: 'Asistent směn není aktivován. Dokupte licenci na helvetiplanovac.cz/assistant', licensed: false },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const draft = (searchParams.get('draft') ?? 'A').toUpperCase() === 'B' ? 'B' : 'A';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Load all data needed by the bot
  const [empRes, draftRes, absenceRes, wpRes, settingsRes] = await Promise.all([
    sb.from('employees').select('*').eq('organization_id', orgId).eq('active', true).order('name'),
    sb.from('work_plans')
      .select('employee_id, date, work_type, start_time, end_time, notes')
      .eq('organization_id', orgId)
      .eq('type', 'draft')
      .eq('draft_label', draft)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`),
    sb.from('attendance_logs').select('employee_id, date, type, start_time, end_time, notes')
      .eq('organization_id', orgId)
      .eq('type', 'absence')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`),
    sb.from('work_plans')
      .select('employee_id, date, work_type, start_time, end_time')
      .eq('organization_id', orgId)
      .neq('type', 'draft')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`),
    sb.from('company_settings').select('extra_settings, closed_dates, saturday_logic_enabled').eq('organization_id', orgId).single(),
  ]);

  const employees = (empRes.data ?? []).map((e: Record<string, unknown>) => ({
    id: String(e.id),
    name: String(e.name ?? ''),
    targetHours: Number(e.target_hours ?? 160),
    labels: (Array.isArray(e.labels) ? e.labels : []).map(String),
    canSaturday: Boolean(e.can_saturday),
    saturdayPriority: Number(e.saturday_priority ?? 0),
    maxSaturdays: Number(e.max_saturdays ?? 0),
    prodejnaTier: Number(e.prodejna_tier ?? e.tier ?? 0),
    employmentType: String(e.employment_type ?? 'Zaměstnanec'),
    shiftPattern: String(e.shift_pattern ?? 'Standardní'),
    storeRating: Number(e.store_rating ?? 3),
  }));

  // Build draft days from schedules — use calendar-style approach
  const draftDays = buildDraftDays(month, draftRes.data ?? [], draft);

  const rawSettings = settingsRes.data as { extra_settings: Record<string, unknown> | null; closed_dates: string | null; saturday_logic_enabled: boolean | null } | null;
  const settings = buildSettings(rawSettings);

  const absences = buildAbsences(absenceRes.data ?? []);

  const workPlans = (wpRes.data ?? []).map((w: Record<string, unknown>) => ({
    employeeId: String(w.employee_id ?? ''),
    employeeName: '',
    date: String(w.date ?? ''),
    workType: String(w.work_type ?? ''),
    startTime: String(w.start_time ?? ''),
    endTime: String(w.end_time ?? ''),
  }));

  // Enrich workPlan employee names
  const empById = Object.fromEntries(employees.map((e: { id: string; name: string }) => [e.id, e.name]));
  workPlans.forEach((wp: { employeeId: string; employeeName: string }) => {
    wp.employeeName = empById[wp.employeeId] ?? '';
  });

  // Call bot service
  const botRes = await fetch(`${BOT_SERVICE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token:      dlcToken,
      monthKey:   month,
      draft,
      employees,
      draftDays,
      absences,
      workPlans,
      settings,
    }),
  });

  const botData = await botRes.json();
  if (!botRes.ok) {
    return NextResponse.json({ error: botData.error ?? 'Bot service error' }, { status: 502 });
  }

  return NextResponse.json(botData);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDraftDays(month: string, draftRows: Record<string, unknown>[], _draft: string) {
  // Group by date
  const byDate: Record<string, { assignedEmployees: string[]; assignedCount: number }> = {};

  for (const row of draftRows) {
    const date = String(row.date ?? '').slice(0, 10);
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { assignedEmployees: [], assignedCount: 0 };
    if (row.employee_id) {
      byDate[date].assignedEmployees.push(String(row.employee_id));
      byDate[date].assignedCount++;
    }
  }

  // Generate every calendar day of the month
  const [year, mon] = month.split('-').map(Number);
  const days = [];
  const daysInMonth = new Date(year, mon, 0).getDate();

  const DAY_NAMES = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, mon - 1, d);
    const dow = dateObj.getDay();
    const isSunday = dow === 0;
    const slot = byDate[date] ?? { assignedEmployees: [], assignedCount: 0 };

    days.push({
      date,
      dayName: DAY_NAMES[dow],
      dayType: isSunday ? 'Zavřeno' : '',
      requiredTotal: isSunday ? 0 : 3,      // default — should come from org settings
      assignedEmployees: slot.assignedEmployees,
      assignedCount: slot.assignedCount,
    });
  }
  return days;
}

function buildSettings(row: { extra_settings: Record<string, unknown> | null; closed_dates: string | null; saturday_logic_enabled: boolean | null } | null) {
  const s: Record<string, unknown> = {};
  if (!row) return s;
  if (row.saturday_logic_enabled != null) s.saturday_logic_enabled = row.saturday_logic_enabled;
  if (row.closed_dates) s.closed_dates = row.closed_dates;
  for (const [k, v] of Object.entries(row.extra_settings ?? {})) {
    s[k] = v;
  }
  return s;
}

function buildAbsences(rows: Array<Record<string, unknown>>) {
  const fullDay: unknown[] = [];
  const partial: unknown[] = [];

  for (const row of rows) {
    const base = {
      employeeId:   String(row.employee_id ?? ''),
      employeeName: String(row.employee_name ?? ''),
      date:         String(row.date ?? '').slice(0, 10),
      type:         String(row.notes ?? row.type ?? 'Absence'),
    };
    if (row.start_time && row.end_time) {
      partial.push({ ...base, startTime: String(row.start_time), endTime: String(row.end_time) });
    } else {
      fullDay.push(base);
    }
  }
  return { fullDay, partial };
}
