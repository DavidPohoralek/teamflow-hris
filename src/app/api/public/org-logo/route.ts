import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const orgId = new URL(req.url).searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ logoUrl: null });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: files } = await sb.storage.from('org-logos').list(orgId);
  if (!files?.length) return NextResponse.json({ logoUrl: null });

  const { data } = sb.storage.from('org-logos').getPublicUrl(`${orgId}/logo`);
  // Cache bust so updated logos show immediately
  return NextResponse.json({ logoUrl: `${data.publicUrl}?t=${Date.now()}` });
}
