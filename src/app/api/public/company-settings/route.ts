import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  if (!orgId) return NextResponse.json({}, { status: 400 });

  const supabase = createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: row } = await supabase
    .from('company_settings')
    .select('kiosk_enabled, ui_theme, saturday_logic_enabled, extra_settings')
    .eq('organization_id', orgId)
    .maybeSingle();

  const r = (row ?? {}) as { kiosk_enabled?: boolean | null; ui_theme?: string | null; saturday_logic_enabled?: boolean | null; extra_settings?: Record<string, unknown> | null };

  return NextResponse.json({
    kiosk_enabled: r.kiosk_enabled ?? false,
    ui_theme: r.ui_theme ?? 'slate',
    saturday_logic_enabled: r.saturday_logic_enabled ?? false,
    // Spread extra_settings so WorkPlanGrid can read hours_mon, closed_dates, evening_shift_*, etc.
    ...(r.extra_settings ?? {}),
  });
}
