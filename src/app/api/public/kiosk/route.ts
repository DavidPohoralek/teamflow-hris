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
    const { orgId, pin, action, workTypeId, workTypeName } = body as {
      orgId: string
      pin: string
      action: 'checkin' | 'checkout'
      workTypeId?: string
      workTypeName?: string
    }

    if (!orgId || !pin || !action) {
      return NextResponse.json({ ok: false, error: 'Chybí povinné parametry' }, { status: 400 })
    }

    if (action !== 'checkin' && action !== 'checkout') {
      return NextResponse.json({ ok: false, error: 'Neplatná akce' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Find employee by pin + org
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name, active')
      .eq('organization_id', orgId)
      .or(`pin_code.eq.${pin},pin.eq.${pin}`)
      .single()

    if (empError || !employee) {
      return NextResponse.json({ ok: false, error: 'Neplatný PIN kód' }, { status: 401 })
    }

    if (!employee.active) {
      return NextResponse.json({ ok: false, error: 'Váš účet není aktivní' }, { status: 403 })
    }

    const today = new Date().toISOString().split('T')[0]

    if (action === 'checkin') {
      // Check if already checked in today
      const { data: existing } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('organization_id', orgId)
        .eq('employee_id', employee.id)
        .eq('date', today)
        .not('check_in', 'is', null)
        .is('check_out', null)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ ok: false, error: 'Již jste přihlášen/a' }, { status: 409 })
      }

      const now = new Date().toISOString()

      // Check if a completed record exists today (same-day re-checkin)
      const { data: completed } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('organization_id', orgId)
        .eq('employee_id', employee.id)
        .eq('date', today)
        .not('check_out', 'is', null)
        .order('check_out', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (completed) {
        // Re-checkin same day: reset the existing row
        const { error: updateError } = await supabase
          .from('attendance_logs')
          .update({
            check_in: now,
            check_out: null,
            ...(workTypeId ? { work_type_id: workTypeId } : {}),
            ...(workTypeName ? { work_type_name: workTypeName } : {}),
          })
          .eq('id', completed.id)

        if (updateError) {
          console.error('Kiosk re-checkin update error:', updateError)
          return NextResponse.json({ ok: false, error: 'Chyba při záznamu příchodu' }, { status: 500 })
        }
      } else {
        const insertData: Record<string, unknown> = {
          organization_id: orgId,
          employee_id: employee.id,
          date: today,
          check_in: now,
        }
        if (workTypeId) insertData.work_type_id = workTypeId
        if (workTypeName) insertData.work_type_name = workTypeName

        const { error: insertError } = await supabase
          .from('attendance_logs')
          .insert(insertData)

        if (insertError) {
          console.error('Kiosk checkin insert error:', insertError)
          return NextResponse.json({ ok: false, error: 'Chyba při záznamu příchodu' }, { status: 500 })
        }
      }

      return NextResponse.json({
        ok: true,
        employee: { name: employee.name },
        checkIn: now,
        workTypeName: workTypeName ?? null,
      })
    }

    // action === 'checkout'
    const { data: log, error: logError } = await supabase
      .from('attendance_logs')
      .select('id, check_in')
      .eq('organization_id', orgId)
      .eq('employee_id', employee.id)
      .eq('date', today)
      .not('check_in', 'is', null)
      .is('check_out', null)
      .maybeSingle()

    if (logError || !log) {
      return NextResponse.json({ ok: false, error: 'Nebyl nalezen záznam příchodu' }, { status: 404 })
    }

    const now = new Date()
    const checkInTime = new Date(log.check_in as string)
    const durationMinutes = Math.round((now.getTime() - checkInTime.getTime()) / 60000)
    const hours = Math.floor(durationMinutes / 60)
    const minutes = durationMinutes % 60
    const durationLabel = `${hours}h ${minutes}m`

    const { error: updateError } = await supabase
      .from('attendance_logs')
      .update({ check_out: now.toISOString() })
      .eq('id', log.id)

    if (updateError) {
      console.error('Kiosk checkout update error:', updateError)
      return NextResponse.json({ ok: false, error: 'Chyba při záznamu odchodu' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      employee: { name: employee.name },
      duration: durationLabel,
    })
  } catch (err) {
    console.error('Kiosk route error:', err)
    return NextResponse.json({ ok: false, error: 'Interní chyba serveru' }, { status: 500 })
  }
}
