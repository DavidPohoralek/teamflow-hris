import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

// Keys that are booleans (stored as 'true'/'false' strings)
const BOOL_KEYS = new Set(['kiosk_enabled', 'saturday_logic_enabled', 'weekend_open']);

// Keys that are numbers
const NUM_KEYS = new Set([
  'bonus_saturday_pct', 'bonus_overtime_threshold', 'bonus_overtime_pct', 'sick_leave_pct',
  'benefit_blood_hours', 'benefit_blood_max', 'benefit_english_hours', 'benefit_english_max',
  'benefit_gym_hours', 'benefit_gym_max',
]);

function parseValue(key: string, raw: string): unknown {
  if (BOOL_KEYS.has(key)) return raw === 'true';
  if (NUM_KEYS.has(key)) return parseFloat(raw) || 0;
  return raw;
}

// GET /api/manager/settings
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const { data: rows, error } = await supabase
    .from('company_settings')
    .select('key, value')
    .eq('organization_id', orgId);

  if (error) {
    return NextResponse.json({ error: 'Nastavení nenalezeno.' }, { status: 404 });
  }

  const settings: Record<string, unknown> = {
    kioskEnabled: false,
    saturday_logic_enabled: false,
    weekend_open: false,
    managerPasswordSet: false,
    ui_theme: 'slate',
    closed_dates: '',
  };

  for (const row of rows ?? []) {
    if (row.key === 'manager_password') {
      settings.managerPasswordSet = Boolean(row.value);
    } else if (row.key === 'kiosk_enabled') {
      settings.kioskEnabled = row.value === 'true';
    } else {
      settings[row.key] = parseValue(row.key, row.value ?? '');
    }
  }

  return NextResponse.json(settings);
}

// PUT /api/manager/settings
export async function PUT(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase } = resolved;

  const body = await req.json() as Record<string, unknown>;

  // Password change handled separately
  if (body.new_password !== undefined || body.newPassword !== undefined) {
    const newPassword = (body.new_password ?? body.newPassword) as string;
    const currentPassword = (body.current_password ?? body.currentPassword) as string | undefined;

    if (!newPassword?.trim()) {
      return NextResponse.json({ error: 'Nové heslo nesmí být prázdné.' }, { status: 400 });
    }

    const { data: existingRow } = await supabase
      .from('company_settings')
      .select('value')
      .eq('organization_id', orgId)
      .eq('key', 'manager_password')
      .maybeSingle();

    const existing = existingRow?.value ?? null;
    const isDefaultOrUnset = existing === null || existing === 'manager123';

    if (!isDefaultOrUnset) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Aktuální heslo je povinné pro změnu hesla.' }, { status: 400 });
      }
      if (existing !== currentPassword) {
        return NextResponse.json({ error: 'Aktuální heslo je nesprávné.' }, { status: 401 });
      }
    }

    await supabase.from('company_settings').upsert(
      { organization_id: orgId, key: 'manager_password', value: newPassword },
      { onConflict: 'organization_id,key' }
    );
    return NextResponse.json({ ok: true });
  }

  // All other settings: upsert each key-value pair
  const SKIP_KEYS = new Set(['current_password', 'currentPassword', 'new_password', 'newPassword']);
  const pairs: { organization_id: string; key: string; value: string }[] = [];

  for (const [key, val] of Object.entries(body)) {
    if (SKIP_KEYS.has(key)) continue;
    // Map camelCase legacy keys
    const dbKey = key === 'kioskEnabled' ? 'kiosk_enabled' : key;
    pairs.push({ organization_id: orgId, key: dbKey, value: String(val) });
  }

  if (pairs.length === 0) {
    return NextResponse.json({ error: 'Nebyla zadána žádná změna.' }, { status: 400 });
  }

  const { error: upsertError } = await supabase
    .from('company_settings')
    .upsert(pairs, { onConflict: 'organization_id,key' });

  if (upsertError) {
    console.error('PUT /api/manager/settings error:', upsertError);
    return NextResponse.json({ error: 'Nepodařilo se uložit nastavení.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
