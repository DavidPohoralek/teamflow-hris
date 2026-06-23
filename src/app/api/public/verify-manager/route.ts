import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Chybí konfigurace Supabase')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgId, password } = body as { orgId: string; password: string }

    if (!orgId || !password) {
      return NextResponse.json({ ok: false, error: 'Chybí povinné parametry' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { data: pwRow } = await supabase
      .from('company_settings')
      .select('value')
      .eq('organization_id', orgId)
      .eq('key', 'manager_password')
      .maybeSingle()

    const storedPassword = pwRow?.value ?? 'manager123'

    if (storedPassword !== password) {
      return NextResponse.json({ ok: false, error: 'Nesprávné heslo' }, { status: 401 })
    }

    const timestamp = Date.now()
    const token = Buffer.from(`${orgId}:${timestamp}`).toString('base64')

    return NextResponse.json({ ok: true, token })
  } catch (err) {
    console.error('Verify-manager route error:', err)
    return NextResponse.json({ ok: false, error: 'Interní chyba serveru' }, { status: 500 })
  }
}
