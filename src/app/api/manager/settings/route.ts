import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// Keys stored in JSONB extra_settings column (not direct columns)
const EXTRA_KEYS = [
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
];

// GET /api/manager/settings
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data: settings, error: settingsError } = await supabase
    .from('company_settings')
    .select('kiosk_enabled, manager_password, saturday_logic_enabled, ui_theme, closed_dates, extra_settings')
    .eq('organization_id', orgId)
    .single();

  if (settingsError || !settings) {
    return NextResponse.json({ error: 'Nastavení nenalezeno.' }, { status: 404 });
  }

  const s = settings as {
    kiosk_enabled: boolean;
    saturday_logic_enabled: boolean | null;
    manager_password: string | null;
    ui_theme: string | null;
    closed_dates: string | null;
    extra_settings: Record<string, unknown> | null;
  };

  const extra = s.extra_settings ?? {};

  return NextResponse.json({
    kioskEnabled: s.kiosk_enabled,
    saturday_logic_enabled: s.saturday_logic_enabled ?? false,
    managerPasswordSet: Boolean(s.manager_password),
    ui_theme: s.ui_theme ?? 'slate',
    closed_dates: s.closed_dates ?? '',
    // Spread extra_settings so NumberSetting / OperatingHoursSetting can read them by key
    ...extra,
  });
}

// PUT /api/manager/settings
// Body: { currentPassword?, newPassword?, kioskEnabled?, saturday_logic_enabled?, ui_theme?, closed_dates?, ...extraKeys }
export async function PUT(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const body = await req.json() as Record<string, unknown>;
  const { currentPassword, newPassword, kioskEnabled, saturday_logic_enabled, ui_theme, closed_dates } = body as {
    currentPassword?: string;
    newPassword?: string;
    kioskEnabled?: boolean;
    saturday_logic_enabled?: boolean;
    ui_theme?: string;
    closed_dates?: string;
  };

  const updates: Record<string, unknown> = {};

  // Password change
  if (newPassword !== undefined) {
    if (typeof newPassword !== 'string' || newPassword.trim().length === 0) {
      return NextResponse.json({ error: 'Nové heslo nesmí být prázdné.' }, { status: 400 });
    }
    const { data: settings } = await supabase
      .from('company_settings')
      .select('manager_password')
      .eq('organization_id', orgId)
      .single();
    const existing = (settings as { manager_password: string | null } | null)?.manager_password ?? null;
    const isDefaultOrUnset = existing === null || existing === 'manager123';
    if (!isDefaultOrUnset) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Aktuální heslo je povinné pro změnu hesla.' }, { status: 400 });
      }
      if (existing !== currentPassword) {
        return NextResponse.json({ error: 'Aktuální heslo je nesprávné.' }, { status: 401 });
      }
    }
    updates.manager_password = newPassword;
  }

  if (kioskEnabled !== undefined) updates.kiosk_enabled = kioskEnabled;
  if (saturday_logic_enabled !== undefined) updates.saturday_logic_enabled = saturday_logic_enabled;
  if (ui_theme !== undefined) updates.ui_theme = ui_theme;
  if (closed_dates !== undefined) updates.closed_dates = closed_dates;

  // Any EXTRA_KEYS in the body go into extra_settings JSONB via merge
  const extraUpdates: Record<string, unknown> = {};
  for (const key of EXTRA_KEYS) {
    if (key in body) extraUpdates[key] = body[key];
  }

  if (Object.keys(updates).length === 0 && Object.keys(extraUpdates).length === 0) {
    return NextResponse.json({ error: 'Nebyla zadána žádná změna.' }, { status: 400 });
  }

  // If we have extra keys, fetch current extra_settings and merge
  if (Object.keys(extraUpdates).length > 0) {
    const { data: current } = await supabase
      .from('company_settings')
      .select('extra_settings')
      .eq('organization_id', orgId)
      .single();

    const currentExtra = (current as { extra_settings: Record<string, unknown> | null } | null)?.extra_settings ?? {};
    updates.extra_settings = { ...currentExtra, ...extraUpdates };
  }

  const { error: updateError } = await supabase
    .from('company_settings')
    .upsert({ organization_id: orgId, ...updates }, { onConflict: 'organization_id' });

  if (updateError) {
    console.error('PUT /api/manager/settings error:', updateError);
    return NextResponse.json({ error: 'Nepodařilo se uložit nastavení.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
