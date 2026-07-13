import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/public/debug?orgId=UUID  — diagnostika DB sloupců (dočasný endpoint)
export async function GET(req: NextRequest) {
  const orgId = new URL(req.url).searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'chybí orgId' }, { status: 400 });

  const supabase = createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Zkusit načíst jednoho zaměstnance se všemi sloupci
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, pin_code, vacation_days_per_year')
    .eq('organization_id', orgId)
    .limit(3);

  if (error) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      hint: 'Pravděpodobně chybí sloupec pin_code nebo vacation_days_per_year — spusť migrace v Supabase',
    });
  }

  return NextResponse.json({
    ok: true,
    columns: ['id', 'name', 'pin_code', 'vacation_days_per_year'],
    sample: data?.map((e) => ({ id: e.id, name: e.name, pin_code: e.pin_code ?? '(prázdný)', vacation_days_per_year: e.vacation_days_per_year ?? '(chybí)' })),
  });
}
