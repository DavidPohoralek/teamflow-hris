import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isTokenValid } from '@/lib/managerAuth'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/public/work-plans?orgId=UUID&employeeId=UUID&month=YYYY-MM
// Returns planned shifts for a specific employee in a month (no auth required — used for "Mé směny" overlay)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  const employeeId = searchParams.get('employeeId');
  const month = searchParams.get('month');

  if (!orgId || !employeeId || !month) {
    return NextResponse.json({ error: 'Chybí parametry.' }, { status: 400 });
  }

  const [year, mo] = month.split('-').map(Number);
  const dateFrom = `${month}-01`;
  const dateTo = new Date(year, mo, 0).toISOString().slice(0, 10);

  const supabase = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('work_plans')
    .select('id, date, start_time, end_time, work_type')
    .eq('organization_id', orgId)
    .eq('employee_id', employeeId)
    .eq('active', true)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date');

  if (error) return NextResponse.json({ error: 'Chyba.' }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}

// POST /api/public/work-plans
// Body: { orgId, employeeId, workTypeId, date, startTime?, endTime?, note? }
export async function POST(req: NextRequest) {
  const rawToken = req.headers.get('Manager-Token')
  const tokenResult = isTokenValid(rawToken ?? '')
  if (!tokenResult.valid) {
    return NextResponse.json({ error: 'Neplatný nebo expirovaný token.' }, { status: 401 })
  }

  let body: {
    orgId: string
    employeeId: string
    workTypeId: string
    date: string
    startTime?: string
    endTime?: string
    note?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Neplatné tělo požadavku.' }, { status: 400 })
  }

  const { orgId, employeeId, workTypeId, date, startTime, endTime, note } = body

  if (!orgId || !employeeId || !workTypeId || !date) {
    return NextResponse.json({ error: 'Chybí povinné parametry.' }, { status: 400 })
  }

  if (tokenResult.orgId !== orgId) {
    return NextResponse.json({ error: 'Token neodpovídá organizaci.' }, { status: 403 })
  }

  const supabase = getServiceClient()

  // Look up work type name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wtData, error: wtError } = await (supabase as any)
    .from('work_types')
    .select('name')
    .eq('id', workTypeId)
    .single()

  if (wtError || !wtData) {
    return NextResponse.json({ error: 'Typ práce nebyl nalezen.' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('work_plans')
    .insert({
      organization_id: orgId,
      employee_id: employeeId,
      work_type_id: workTypeId,
      work_type: wtData.name,
      date,
      start_time: startTime ?? null,
      end_time: endTime ?? null,
      note: note ?? null,
      active: true,
    })
    .select('id')
    .single()

  if (error) {
    console.error('public/work-plans POST error:', error)
    return NextResponse.json({ error: 'Nepodařilo se přidat směnu.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}

// DELETE /api/public/work-plans?workPlanId=UUID&orgId=UUID
export async function DELETE(req: NextRequest) {
  const rawToken = req.headers.get('Manager-Token')
  const tokenResult = isTokenValid(rawToken ?? '')
  if (!tokenResult.valid) {
    return NextResponse.json({ error: 'Neplatný nebo expirovaný token.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const workPlanId = searchParams.get('workPlanId')
  const orgId = searchParams.get('orgId')

  if (!workPlanId || !orgId) {
    return NextResponse.json({ error: 'Chybí parametry workPlanId nebo orgId.' }, { status: 400 })
  }

  if (tokenResult.orgId !== orgId) {
    return NextResponse.json({ error: 'Token neodpovídá organizaci.' }, { status: 403 })
  }

  const supabase = getServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('work_plans')
    .update({ active: false })
    .eq('id', workPlanId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('public/work-plans DELETE error:', error)
    return NextResponse.json({ error: 'Nepodařilo se odebrat směnu.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
