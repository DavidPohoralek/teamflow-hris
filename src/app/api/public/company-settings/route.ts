import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const NUM_KEYS = new Set([
  'bonus_saturday_pct', 'bonus_overtime_threshold', 'bonus_overtime_pct', 'sick_leave_pct',
  'benefit_blood_hours', 'benefit_blood_max', 'benefit_english_hours', 'benefit_english_max',
  'benefit_gym_hours', 'benefit_gym_max',
]);

const BOOL_KEYS = new Set(['kiosk_enabled', 'saturday_logic_enabled', 'weekend_open']);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  if (!orgId) return NextResponse.json({}, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows } = await supabase
    .from('company_settings')
    .select('key, value')
    .eq('organization_id', orgId);

  const result: Record<string, unknown> = {
    kiosk_enabled: false,
    ui_theme: 'slate',
    closed_dates: '',
  };

  for (const row of rows ?? []) {
    if (row.key === 'manager_password') continue;
    if (BOOL_KEYS.has(row.key)) {
      result[row.key] = row.value === 'true';
    } else if (NUM_KEYS.has(row.key)) {
      result[row.key] = parseFloat(row.value ?? '') || 0;
    } else {
      result[row.key] = row.value ?? '';
    }
  }

  return NextResponse.json(result);
}
