import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// Keys stored in extra_settings JSONB (not direct columns on the table)
const EXTRA_KEYS = [
  'closed_dates',
  'bonus_saturday_pct',
  'bonus_overtime_threshold',
  'bonus_overtime_pct',
  'sick_leave_pct',
  'hours_mon',
  'hours_tue',
  'hours_wed',
  'hours_thu',
  'hours_fri',
  'hours_sat',
  'hours_sun',
  'benefit_blood_hours',
  'benefit_blood_max',
  'benefit_english_hours',
  'benefit_english_max',
  'benefit_gym_hours',
  'benefit_gym_max',
  'evening_shift_enabled',
  'evening_shift_start',
  'evening_shift_end',
  'evening_shift_min_staff',
  'evening_shift_label',
  'favicon_url',
  'required_mon',
  'required_tue',
  'required_wed',
  'required_thu',
  'required_fri',
  'required_sat',
  'required_sun',
  'vacation_counting_mode',
];

// GET /api/manager/settings
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data: row, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Nastavení nenalezeno.' }, { status: 404 });
  }

  const s = (row ?? {}) as {
    kiosk_enabled?: boolean | null;
    saturday_logic_enabled?: boolean | null;
    weekend_open?: boolean | null;
    manager_password?: string | null;
    ui_theme?: string | null;
    extra_settings?: Record<string, unknown> | null;
  };

  return NextResponse.json({
    kioskEnabled: s.kiosk_enabled ?? false,
    saturday_logic_enabled: s.saturday_logic_enabled ?? false,
    weekend_open: s.weekend_open ?? false,
    managerPasswordSet: Boolean(s.manager_password),
    ui_theme: s.ui_theme ?? 'slate',
    // Spread extra_settings so NumberSetting / OperatingHoursSetting can read by key
    ...(s.extra_settings ?? {}),
  });
}

// PUT /api/manager/settings
export async function PUT(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const body = await req.json() as Record<string, unknown>;
  const { new_password, newPassword, current_password, currentPassword, kioskEnabled, kiosk_enabled, saturday_logic_enabled, weekend_open, ui_theme } = body as Record<string, unknown>;

  const updates: Record<string, unknown> = {};

  // Password change
  const incomingNew = (new_password ?? newPassword) as string | undefined;
  if (incomingNew !== undefined) {
    if (!incomingNew?.trim()) {
      return NextResponse.json({ error: 'Nové heslo nesmí být prázdné.' }, { status: 400 });
    }
    const incomingCurrent = (current_password ?? currentPassword) as string | undefined;
    const { data: existingRow } = await supabase
      .from('company_settings')
      .select('manager_password')
      .eq('organization_id', orgId)
      .maybeSingle();
    const existing = (existingRow as { manager_password: string | null } | null)?.manager_password ?? null;
    const isDefaultOrUnset = existing === null || existing === 'manager123';
    if (!isDefaultOrUnset) {
      if (!incomingCurrent) return NextResponse.json({ error: 'Aktuální heslo je povinné.' }, { status: 400 });
      if (existing !== incomingCurrent) return NextResponse.json({ error: 'Aktuální heslo je nesprávné.' }, { status: 401 });
    }
    updates.manager_password = incomingNew;
  }

  // Direct boolean/string columns
  const kioskVal = kioskEnabled ?? kiosk_enabled;
  if (kioskVal !== undefined) updates.kiosk_enabled = Boolean(kioskVal);
  if (saturday_logic_enabled !== undefined) updates.saturday_logic_enabled = Boolean(saturday_logic_enabled);
  if (weekend_open !== undefined) updates.weekend_open = Boolean(weekend_open);
  if (ui_theme !== undefined) updates.ui_theme = String(ui_theme);

  // Keys that go into extra_settings JSONB
  const extraUpdates: Record<string, unknown> = {};
  for (const key of EXTRA_KEYS) {
    if (key in body) extraUpdates[key] = body[key];
  }

  if (Object.keys(updates).length === 0 && Object.keys(extraUpdates).length === 0) {
    return NextResponse.json({ error: 'Nebyla zadána žádná změna.' }, { status: 400 });
  }

  if (Object.keys(extraUpdates).length > 0) {
    const { data: current } = await supabase
      .from('company_settings')
      .select('extra_settings')
      .eq('organization_id', orgId)
      .maybeSingle();
    const currentExtra = (current as { extra_settings?: Record<string, unknown> | null } | null)?.extra_settings ?? {};
    updates.extra_settings = { ...currentExtra, ...extraUpdates };
  }

  const { error: upsertError } = await supabase
    .from('company_settings')
    .upsert({ organization_id: orgId, ...updates }, { onConflict: 'organization_id' });

  if (upsertError) {
    console.error('PUT /api/manager/settings error:', upsertError);
    return NextResponse.json({ error: 'Nepodařilo se uložit nastavení.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
