import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  if (!orgId) return NextResponse.json({}, { status: 400 });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from('company_settings')
    .select('kiosk_enabled, ui_theme, closed_dates')
    .eq('organization_id', orgId)
    .single();
  if (!data) return NextResponse.json({});
  const row = data as { kiosk_enabled: boolean | null; ui_theme: string | null; closed_dates: string | null };
  return NextResponse.json({
    kiosk_enabled: row.kiosk_enabled ?? false,
    ui_theme: row.ui_theme ?? 'slate',
    closed_dates: row.closed_dates ?? '',
  });
}
