import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/public/debug?orgId=UUID  — diagnostika DB sloupců + env vars
export async function GET(req: NextRequest) {
  const orgId = new URL(req.url).searchParams.get('orgId');

  // Env var diagnostic (no secret values exposed)
  // Use bracket notation to bypass webpack static replacement
  const e = process.env as Record<string, string | undefined>;
  const envDiag = {
    // Dotted notation (may be inlined by webpack at build time):
    dot_SUPABASE_URL: !!process.env.SUPABASE_URL,
    dot_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    dot_NEXT_PUBLIC_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Bracket notation (reads from real runtime process.env):
    bracket_SUPABASE_URL: !!e['SUPABASE_URL'],
    bracket_SERVICE_ROLE_KEY: !!e['SUPABASE_SERVICE_ROLE_KEY'],
    bracket_NEXT_PUBLIC_URL: !!e['NEXT_PUBLIC_SUPABASE_URL'],
    bracket_URL_prefix: (e['SUPABASE_URL'] ?? '').slice(0, 20) || '(undefined)',
    // All runtime keys containing SUPA (shows what Lambda actually has):
    runtime_supa_keys: Object.keys(e).filter(k => k.includes('SUPA')).sort(),
    // Lambda env confirmation:
    is_lambda: !!e['LAMBDA_TASK_ROOT'],
    aws_region: e['AWS_REGION'] ?? '(none)',
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
