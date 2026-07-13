import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  return createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const BUCKET = 'org-logos';

// GET /api/org/logo — vrátí public URL loga
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId } = resolved;

  const sb = getServiceSupabase();
  const { data } = sb.storage.from(BUCKET).getPublicUrl(`${orgId}/logo`);
  // Check if file actually exists
  const { error } = await sb.storage.from(BUCKET).list(orgId);
  if (error || !data) return NextResponse.json({ logoUrl: null });

  return NextResponse.json({ logoUrl: data.publicUrl });
}

// POST /api/org/logo — upload loga (multipart/form-data)
export async function POST(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId } = resolved;

  const formData = await req.formData();
  const file = formData.get('logo') as File | null;
  if (!file) return NextResponse.json({ error: 'Chybí soubor' }, { status: 400 });

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Povolené formáty: PNG, JPG, WEBP, SVG' }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Maximální velikost je 2 MB' }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const bytes = await file.arrayBuffer();

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(`${orgId}/logo`, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = sb.storage.from(BUCKET).getPublicUrl(`${orgId}/logo`);
  return NextResponse.json({ logoUrl: data.publicUrl });
}

// DELETE /api/org/logo — smaže logo
export async function DELETE(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId } = resolved;

  const sb = getServiceSupabase();
  await sb.storage.from(BUCKET).remove([`${orgId}/logo`]);
  return NextResponse.json({ ok: true });
}
