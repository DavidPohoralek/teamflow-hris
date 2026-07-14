import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

// GET /api/public/shift-confirm?orgId=…&pin=…&month=YYYY-MM
// Returns { confirmed: boolean }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  const pin = searchParams.get('pin')
  const month = searchParams.get('month')
  if (!orgId || !pin || !month) {
    return NextResponse.json({ confirmed: false })
  }
  const supabase = getServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: emp } = await (supabase as any)
    .from('employees').select('id')
    .eq('organization_id', orgId)
    .eq('pin_code', pin)
    .eq('active', true)
    .maybeSingle()
  if (!emp) return NextResponse.json({ confirmed: false })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('shift_confirmations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('employee_id', emp.id)
    .eq('month', month)
    .maybeSingle()
  return NextResponse.json({ confirmed: !!data })
}

// POST /api/public/shift-confirm
// Body: { orgId, pin, month }
export async function POST(req: NextRequest) {
  try {
    const { orgId, pin, month } = await req.json()
    if (!orgId || !pin || !month) {
      return NextResponse.json({ ok: false, error: 'Chybí parametry' }, { status: 400 })
    }
    const supabase = getServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: emp } = await (supabase as any)
      .from('employees').select('id, name')
      .eq('organization_id', orgId)
      .eq('pin_code', pin)
      .eq('active', true)
      .maybeSingle()
    if (!emp) return NextResponse.json({ ok: false, error: 'Neplatný PIN' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('shift_confirmations')
      .upsert(
        { organization_id: orgId, employee_id: emp.id, month, confirmed_at: new Date().toISOString() },
        { onConflict: 'organization_id,employee_id,month' }
      )
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, employeeName: emp.name })
  } catch {
    return NextResponse.json({ ok: false, error: 'Interní chyba' }, { status: 500 })
  }
}
