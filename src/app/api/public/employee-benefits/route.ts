import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Chybí konfigurace Supabase')
  return createClient(url, key)
}

async function resolveEmployee(supabase: ReturnType<typeof getServiceClient>, orgId: string, pin: string) {
  const { data, error } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', orgId)
    .eq('active', true)
    .eq('pin_code', pin)
    .maybeSingle()
  if (error || !data) return null
  return data
}

// GET /api/public/employee-benefits?orgId=UUID&pin=XXXX&month=YYYY-MM
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  const pin = searchParams.get('pin')
  const month = searchParams.get('month')

  if (!orgId || !pin || !month) {
    return NextResponse.json({ error: 'Chybí parametry.' }, { status: 400 })
  }

  const supabase = getServiceClient()
  const employee = await resolveEmployee(supabase, orgId, pin)
  if (!employee) return NextResponse.json({ error: 'Nesprávný PIN.' }, { status: 401 })

  const { data, error } = await supabase
    .from('employee_benefit_logs')
    .select('benefit_key, count')
    .eq('organization_id', orgId)
    .eq('employee_id', employee.id)
    .eq('month', month)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts: Record<string, number> = {}
  for (const row of data ?? []) counts[row.benefit_key] = row.count

  return NextResponse.json({ counts })
}

// POST /api/public/employee-benefits
// Body: { orgId, pin, month, benefit_key, count }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { orgId: string; pin: string; month: string; benefit_key: string; count: number }
    const { orgId, pin, month, benefit_key, count } = body

    if (!orgId || !pin || !month || !benefit_key || count == null) {
      return NextResponse.json({ error: 'Chybí parametry.' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const employee = await resolveEmployee(supabase, orgId, pin)
    if (!employee) return NextResponse.json({ error: 'Nesprávný PIN.' }, { status: 401 })

    const { error } = await supabase
      .from('employee_benefit_logs')
      .upsert(
        { organization_id: orgId, employee_id: employee.id, month, benefit_key, count, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id,employee_id,month,benefit_key' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/public/employee-benefits error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
  }
}
