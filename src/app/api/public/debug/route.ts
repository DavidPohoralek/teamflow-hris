import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/public/debug?orgId=UUID  — diagnostika DB sloupců + env vars
export async function GET(req: NextRequest) {
  const orgId = new URL(req.url).searchParams.get('orgId');

  // Env var diagnostic (no secret values exposed)
  const envDiag = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL_value: (process.env.SUPABASE_URL ?? '').slice(0, 30) || '(undefined)',
    NEXT_PUBLIC_SUPABASE_URL_value: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').slice(0, 30) || '(undefined)',
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  if (!orgId) return NextResponse.json({ env: envDiag });

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ env: envDiag, error: 'missing url or key' }, { status: 500 });

  const supabase = createClient(url, key);

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
