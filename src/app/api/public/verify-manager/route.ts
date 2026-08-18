import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { buildAdminToken } from '@/lib/managerAuth'

// Brute-force lockout: after MAX_FAILS failed attempts from one IP within
// WINDOW_MS, further attempts are refused (429) until the window rolls off.
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILS = 8

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Chybí konfigurace Supabase')
  return createClient(url, key)
}

// Best-effort client IP behind a proxy/CDN — first hop of x-forwarded-for.
function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  const first = fwd.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgId, password } = body as { orgId: string; password: string }

    if (!orgId || !password) {
      return NextResponse.json({ ok: false, error: 'Chybí povinné parametry' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const ip = getClientIp(req)

    // 1) Rate-limit gate. Fails open (the whole block is best-effort) so a DB
    //    hiccup or a not-yet-run migration never locks a legit admin out.
    try {
      const since = new Date(Date.now() - WINDOW_MS).toISOString()
      const { count, error } = await supabase
        .from('manager_login_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', since)
      if (!error && (count ?? 0) >= MAX_FAILS) {
        return NextResponse.json(
          { ok: false, error: 'Příliš mnoho pokusů. Zkuste to za 15 minut.' },
          { status: 429 }
        )
      }
    } catch {
      /* ignore — never block on the limiter itself */
    }

    // 2) Password check
    const { data: settings } = await supabase
      .from('company_settings')
      .select('manager_password')
      .eq('organization_id', orgId)
      .maybeSingle()

    const storedPassword = (settings as { manager_password?: string | null } | null)?.manager_password ?? 'manager123'

    if (storedPassword !== password) {
      // Record the miss so repeated failures from this IP trip the limiter.
      try {
        await supabase.from('manager_login_attempts').insert({ ip, org_id: orgId })
      } catch { /* best-effort */ }
      return NextResponse.json({ ok: false, error: 'Nesprávné heslo' }, { status: 401 })
    }

    // 3) Success → clear this IP's recorded failures, issue the token.
    try {
      await supabase.from('manager_login_attempts').delete().eq('ip', ip)
    } catch { /* best-effort */ }

    const token = buildAdminToken(orgId)
    return NextResponse.json({ ok: true, token })
  } catch (err) {
    console.error('Verify-manager route error:', err)
    return NextResponse.json({ ok: false, error: 'Interní chyba serveru' }, { status: 500 })
  }
}
