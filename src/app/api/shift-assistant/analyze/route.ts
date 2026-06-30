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
  const [empRes, draftRes, absenceRes, wpRes, settingsRes, scheduleDaysRes] = await Promise.all([
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
    sb.from('company_settings').select('extra_settings, saturday_logic_enabled').eq('organization_id', orgId).maybeSingle(),
    // schedule_days holds requiredTotal and dayType per date
    sb.from('schedule_days')
      .select('date, required_total, day_type, start_time, end_time')
      .eq('organization_id', orgId)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`),
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

  // Build draft days — merge schedule_days config with draft assignments + confirmed shifts
  const confirmedByDate: Record<string, number> = {};
  for (const wp of (wpRes.data ?? [])) {
    const d = String(wp.date ?? '').slice(0, 10);
    if (d) confirmedByDate[d] = (confirmedByDate[d] ?? 0) + 1;
  }
  const orgSettings = buildSettings(settingsRes.data);
  const draftDays = buildDraftDays(month, draftRes.data ?? [], draft, scheduleDaysRes.data ?? [], confirmedByDate, orgSettings);

  const settings = orgSettings;

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

const DOW_REQUIRED_KEYS = ['required_sun','required_mon','required_tue','required_wed','required_thu','required_fri','required_sat'];

function buildDraftDays(
  month: string,
  draftRows: Record<string, unknown>[],
  _draft: string,
  scheduleDays: Record<string, unknown>[],
  confirmedByDate: Record<string, number>,
  orgSettings: Record<string, unknown> = {},
) {
  // Index schedule_days config by date
  const schedMeta: Record<string, { requiredTotal: number; dayType: string; startTime: string | null; endTime: string | null }> = {};
  for (const row of scheduleDays) {
    const date = String(row.date ?? '').slice(0, 10);
    if (date) schedMeta[date] = {
      requiredTotal: Number(row.required_total ?? 0),
      dayType: String(row.day_type ?? ''),
      startTime: row.start_time ? String(row.start_time) : null,
      endTime: row.end_time ? String(row.end_time) : null,
    };
  }

  // Group draft rows by date
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

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const DAY_NAMES = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
  const days = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, mon - 1, d);
    const dow = dateObj.getDay();
    const isSunday = dow === 0;
    const slot = byDate[date] ?? { assignedEmployees: [], assignedCount: 0 };
    const meta = schedMeta[date];

    // requiredTotal: schedule_days override → org settings per-dow → Sunday=0 → fallback 3
    const dowKey = DOW_REQUIRED_KEYS[dow];
    const orgDefault = dowKey && orgSettings[dowKey] != null ? Number(orgSettings[dowKey]) : (isSunday ? 0 : 3);
    const requiredTotal = meta ? meta.requiredTotal : orgDefault;
    // dayType: from schedule_days, or 'Zavřeno' for Sunday
    const dayType = meta?.dayType || (isSunday ? 'Zavřeno' : '');
    // Confirmed (non-draft) shifts already assigned to this day
    const confirmedCount = confirmedByDate[date] ?? 0;

    days.push({
      date,
      dayName: DAY_NAMES[dow],
      dayType,
      requiredTotal,
      startTime: meta?.startTime ?? null,
      endTime: meta?.endTime ?? null,
      assignedEmployees: slot.assignedEmployees,
      assignedCount: slot.assignedCount,
      confirmedCount,          // bot can subtract confirmed from missing
    });
  }
  return days;
}

function buildSettings(row: { extra_settings: Record<string, unknown> | null; saturday_logic_enabled: boolean | null } | null) {
  const s: Record<string, unknown> = {};
  if (!row) return s;
  if (row.saturday_logic_enabled != null) s.saturday_logic_enabled = row.saturday_logic_enabled;
  for (const [k, v] of Object.entries(row.extra_settings ?? {})) { s[k] = v; }
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
