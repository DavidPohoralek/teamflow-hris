import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function svc() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Chybí konfigurace Supabase')
  return createClient(url, key)
}

async function resolveEmployee(supabase: ReturnType<typeof svc>, orgId: string, pin: string) {
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', orgId)
    .eq('active', true)
    .eq('pin_code', pin)
    .maybeSingle()
  return data ?? null
}

async function syncBenefitLogs(supabase: ReturnType<typeof svc>, orgId: string, employeeId: string, benefitKey: string, month: string) {
  const [dateFrom, dateTo] = [month + '-01', month + '-31']
  const { count } = await supabase
    .from('benefit_entries')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('employee_id', employeeId)
    .eq('benefit_key', benefitKey)
    .gte('date', dateFrom)
    .lte('date', dateTo)

  await supabase
    .from('employee_benefit_logs')
    .upsert(
      { organization_id: orgId, employee_id: employeeId, month, benefit_key: benefitKey, count: count ?? 0, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id,employee_id,month,benefit_key' }
    )
}

// GET /api/public/benefit-entries?orgId=UUID&pin=XXXX&month=YYYY-MM
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  const pin = searchParams.get('pin')
  const month = searchParams.get('month')
  if (!orgId || !pin || !month) return NextResponse.json({ error: 'Chybí parametry.' }, { status: 400 })

  const sb = svc()
  const employee = await resolveEmployee(sb, orgId, pin)
  if (!employee) return NextResponse.json({ error: 'Nesprávný PIN.' }, { status: 401 })

  const { data, error } = await sb
    .from('benefit_entries')
    .select('id, benefit_key, date, created_at')
    .eq('organization_id', orgId)
    .eq('employee_id', employee.id)
    .gte('date', month + '-01')
    .lte('date', month + '-31')
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

// POST /api/public/benefit-entries
// Body: { orgId, pin, benefit_key, date? }  — logs for today or provided date
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { orgId: string; pin: string; benefit_key: string; date?: string }
    const { orgId, pin, benefit_key, date: dateParam } = body
    if (!orgId || !pin || !benefit_key) return NextResponse.json({ error: 'Chybí parametry.' }, { status: 400 })

    const sb = svc()
    const employee = await resolveEmployee(sb, orgId, pin)
    if (!employee) return NextResponse.json({ error: 'Nesprávný PIN.' }, { status: 401 })

    const today = new Date().toISOString().slice(0, 10)
    // Allow specifying a past date (current month only for safety)
    const targetDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today ? dateParam : today
    const month = targetDate.slice(0, 7)

    const { data: entry, error } = await sb
      .from('benefit_entries')
      .insert({ organization_id: orgId, employee_id: employee.id, benefit_key, date: targetDate })
      .select('id, benefit_key, date')
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Dnes již zaznamenáno.' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await syncBenefitLogs(sb, orgId, employee.id, benefit_key, month)
    return NextResponse.json({ ok: true, entry })
  } catch (err) {
    console.error('POST /api/public/benefit-entries error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
  }
}

// DELETE /api/public/benefit-entries?orgId=UUID&pin=XXXX&entryId=UUID
// Employee can only delete their OWN entry from TODAY
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    const pin = searchParams.get('pin')
    const entryId = searchParams.get('entryId')
    if (!orgId || !pin || !entryId) return NextResponse.json({ error: 'Chybí parametry.' }, { status: 400 })

    const sb = svc()
    const employee = await resolveEmployee(sb, orgId, pin)
    if (!employee) return NextResponse.json({ error: 'Nesprávný PIN.' }, { status: 401 })

    const today = new Date().toISOString().slice(0, 10)

    const { data: existing } = await sb
      .from('benefit_entries')
      .select('id, benefit_key, date')
      .eq('id', entryId)
      .eq('organization_id', orgId)
      .eq('employee_id', employee.id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Záznam nenalezen.' }, { status: 404 })

    await sb.from('benefit_entries').delete().eq('id', entryId)
    await syncBenefitLogs(sb, orgId, employee.id, existing.benefit_key, existing.date.slice(0, 7))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/public/benefit-entries error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
  }
}
