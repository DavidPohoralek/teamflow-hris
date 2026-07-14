import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isTokenValid } from '@/lib/managerAuth'

function getServiceClient() {
  return createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
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
    .select('id, date, start_time, end_time, work_type, is_evening')
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
    isEvening?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Neplatné tělo požadavku.' }, { status: 400 })
  }

  const { orgId, employeeId, workTypeId, date, startTime, endTime, note, isEvening } = body

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

  // Overlap check: reject if employee already has a shift that day with overlapping (or identical) times
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('work_plans')
    .select('id, start_time, end_time, work_type')
    .eq('organization_id', orgId)
    .eq('employee_id', employeeId)
    .eq('date', date)
    .eq('active', true)

  for (const plan of (existing ?? []) as { id: string; start_time: string | null; end_time: string | null; work_type: string | null }[]) {
    // Exact duplicate
    if (plan.start_time === (startTime ?? null) && plan.end_time === (endTime ?? null)) {
      const timeStr = plan.start_time ? `${plan.start_time}–${plan.end_time ?? ''}` : '';
      return NextResponse.json(
        { error: `Zaměstnanec má v tento den již směnu${timeStr ? ' ' + timeStr : ''} (${plan.work_type ?? ''}). Nelze přidat duplicitní záznam.` },
        { status: 409 }
      )
    }
    // Time overlap (lexicographic HH:MM comparison)
    const ns = startTime ?? null, ne = endTime ?? null;
    const es = plan.start_time, ee = plan.end_time;
    if (ns && ne && es && ee && ns < ee && ne > es) {
      return NextResponse.json(
        { error: `Zaměstnanec má v tento den směnu ${es}–${ee} (${plan.work_type ?? ''}), která se překrývá.` },
        { status: 409 }
      )
    }
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
      is_evening: isEvening ?? false,
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

// DELETE /api/public/work-plans?workPlanId=UUID&orgId=UUID[&pin=XXXX]
// Manager-Token in header → full manager delete
// pin query param → employee can only delete their own shift
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workPlanId = searchParams.get('workPlanId')
  const orgId = searchParams.get('orgId')
  const pin = searchParams.get('pin')

  if (!workPlanId || !orgId) {
    return NextResponse.json({ error: 'Chybí parametry workPlanId nebo orgId.' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // ── PIN-authenticated delete (employee removes their own shift) ──────────────
  if (pin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: emp } = await (supabase as any)
      .from('employees')
      .select('id')
      .eq('organization_id', orgId)
      .eq('pin_code', pin)
      .eq('active', true)
      .maybeSingle()

    if (!emp) {
      return NextResponse.json({ error: 'Neplatný PIN.' }, { status: 401 })
    }

    // Verify the work plan belongs to this employee
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: plan } = await (supabase as any)
      .from('work_plans')
      .select('id, employee_id')
      .eq('id', workPlanId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!plan || plan.employee_id !== emp.id) {
      return NextResponse.json({ error: 'Nemáte oprávnění smazat tuto směnu.' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('work_plans')
      .update({ active: false })
      .eq('id', workPlanId)
      .eq('organization_id', orgId)

    if (error) return NextResponse.json({ error: 'Nepodařilo se odebrat směnu.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── Manager-Token authenticated delete ──────────────────────────────────────
  const rawToken = req.headers.get('Manager-Token')
  const tokenResult = isTokenValid(rawToken ?? '')
  if (!tokenResult.valid) {
    return NextResponse.json({ error: 'Neplatný nebo expirovaný token.' }, { status: 401 })
  }
  if (tokenResult.orgId !== orgId) {
    return NextResponse.json({ error: 'Token neodpovídá organizaci.' }, { status: 403 })
  }

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

// PATCH /api/public/work-plans
// Body: { orgId, workPlanId, workTypeId?, startTime?, endTime? }
// Manager-Token or PIN required
export async function PATCH(req: NextRequest) {
  let body: {
    orgId: string
    workPlanId: string
    workTypeId?: string
    startTime?: string | null
    endTime?: string | null
    pin?: string
    isEvening?: boolean
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Neplatné tělo.' }, { status: 400 }) }

  const { orgId, workPlanId, workTypeId, startTime, endTime, pin, isEvening } = body
  if (!orgId || !workPlanId) return NextResponse.json({ error: 'Chybí parametry.' }, { status: 400 })

  const supabase = getServiceClient()

  // Auth: Manager-Token or PIN
  const rawToken = req.headers.get('Manager-Token')
  const tokenResult = isTokenValid(rawToken ?? '')
  if (!tokenResult.valid || tokenResult.orgId !== orgId) {
    // Fall back to PIN auth
    if (!pin) return NextResponse.json({ error: 'Neplatná autorizace.' }, { status: 401 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: emp } = await (supabase as any)
      .from('employees').select('id').eq('organization_id', orgId)
      .eq('pin_code', pin).eq('active', true).maybeSingle()
    if (!emp) return NextResponse.json({ error: 'Neplatný PIN.' }, { status: 401 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: plan } = await (supabase as any)
      .from('work_plans').select('employee_id').eq('id', workPlanId).eq('organization_id', orgId).maybeSingle()
    if (!plan || plan.employee_id !== emp.id)
      return NextResponse.json({ error: 'Nemáte oprávnění upravit tuto směnu.' }, { status: 403 })
  }

  // Resolve work type name if workTypeId provided
  const update: Record<string, unknown> = {}
  if (workTypeId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: wt } = await (supabase as any).from('work_types').select('name').eq('id', workTypeId).single()
    if (!wt) return NextResponse.json({ error: 'Typ práce nenalezen.' }, { status: 404 })
    update.work_type_id = workTypeId
    update.work_type = wt.name
  }
  if (startTime !== undefined) update.start_time = startTime ?? null
  if (endTime !== undefined) update.end_time = endTime ?? null
  if (isEvening !== undefined) update.is_evening = isEvening

  if (!Object.keys(update).length)
    return NextResponse.json({ error: 'Nic ke změně.' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('work_plans').update(update).eq('id', workPlanId).eq('organization_id', orgId)

  if (error) return NextResponse.json({ error: 'Nepodařilo se upravit směnu.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
