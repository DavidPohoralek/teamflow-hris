import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// GET /api/manager/settings
// Returns current settings (without password)
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data: settings, error: settingsError } = await supabase
    .from('company_settings')
    .select('kiosk_enabled, manager_password, saturday_logic_enabled, ui_theme')
    .eq('organization_id', orgId)
    .single();

  if (settingsError || !settings) {
    return NextResponse.json({ error: 'Nastavení nenalezeno.' }, { status: 404 });
  }

  const s = settings as { kiosk_enabled: boolean; saturday_logic_enabled: boolean | null; manager_password: string | null; ui_theme: string | null };
  return NextResponse.json({
    kioskEnabled: s.kiosk_enabled,
    saturday_logic_enabled: s.saturday_logic_enabled ?? false,
    managerPasswordSet: Boolean(s.manager_password),
    ui_theme: s.ui_theme ?? 'slate',
  });
}

// PUT /api/manager/settings
// Body: { currentPassword?, newPassword?, kioskEnabled?, saturday_logic_enabled? }
// Password change requires currentPassword; feature toggles do not.
export async function PUT(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const body = await req.json();
  const { currentPassword, newPassword, kioskEnabled, saturday_logic_enabled, ui_theme } = body as {
    currentPassword?: string;
    newPassword?: string;
    kioskEnabled?: boolean;
    saturday_logic_enabled?: boolean;
    ui_theme?: string;
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
    // Initial setup: password not set yet — allow without currentPassword
    if (existing !== null) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Aktuální heslo je povinné pro změnu hesla.' }, { status: 400 });
      }
      if (existing !== currentPassword) {
        return NextResponse.json({ error: 'Aktuální heslo je nesprávné.' }, { status: 401 });
      }
    }
    updates.manager_password = newPassword;
  }

  // Feature toggles — no password required (manager session is already authenticated)
  if (kioskEnabled !== undefined) {
    updates.kiosk_enabled = kioskEnabled;
  }
  if (saturday_logic_enabled !== undefined) {
    updates.saturday_logic_enabled = saturday_logic_enabled;
  }
  if (ui_theme !== undefined) {
    updates.ui_theme = ui_theme;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nebyla zadána žádná změna.' }, { status: 400 });
  }

  // Use upsert so new orgs (no company_settings row yet) get one created
  const { error: updateError } = await supabase
    .from('company_settings')
    .upsert({ organization_id: orgId, ...updates }, { onConflict: 'organization_id' });

  if (updateError) {
    console.error('PUT /api/manager/settings error:', updateError);
    return NextResponse.json({ error: 'Nepodařilo se uložit nastavení.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
