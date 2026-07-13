import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
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
      action: 'checkin' | 'checkout' | 'ho-record'
      workTypeId?: string
      workTypeName?: string
    }

    if (!orgId || !pin || !action) {
      return NextResponse.json({ ok: false, error: 'Chybí povinné parametry' }, { status: 400 })
    }

    if (action !== 'checkin' && action !== 'checkout' && action !== 'ho-record') {
      return NextResponse.json({ ok: false, error: 'Neplatná akce' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Find employee by pin + org (active only — avoids .single() failing on duplicate PINs across active/inactive rows)
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name, active')
      .eq('organization_id', orgId)
      .eq('active', true)
      .or(`pin_code.eq.${pin},pin.eq.${pin}`)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json({ ok: false, error: 'Neplatný PIN kód' }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0]

    if (action === 'checkin') {
      const now = new Date().toISOString()

      // If an open session exists, auto-close it first so every tap is recorded
      const { data: openSession } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('organization_id', orgId)
        .eq('employee_id', employee.id)
        .eq('date', today)
        .not('check_in', 'is', null)
        .is('check_out', null)
        .maybeSingle()

      if (openSession) {
        await supabase
          .from('attendance_logs')
          .update({ check_out: now })
          .eq('id', openSession.id)
      }

      // Always insert a fresh row — every check-in is its own record
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
        // Unique constraint still in place — fall back to updating the existing row
        // so check-in at least works. Drop the index in Supabase to record every session.
        if (insertError.code === '23505') {
          const { error: updateError } = await supabase
            .from('attendance_logs')
            .update({ check_in: now, check_out: null,
              ...(workTypeId ? { work_type_id: workTypeId } : {}),
              ...(workTypeName ? { work_type_name: workTypeName } : {}),
            })
            .eq('organization_id', orgId)
            .eq('employee_id', employee.id)
            .eq('date', today)
          if (updateError) {
            console.error('Kiosk checkin fallback update error:', updateError)
            return NextResponse.json({ ok: false, error: 'Chyba při záznamu příchodu' }, { status: 500 })
          }
        } else {
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

    // ── action === 'ho-record' ─────────────────────────────────────────────
    if (action === 'ho-record') {
      const { date: recordDate, startTime, endTime, note } = body as {
        date?: string; startTime: string; endTime: string; note?: string | null
      }
      const date = recordDate ?? today

      if (!startTime || !endTime) {
        return NextResponse.json({ ok: false, error: 'Zadejte čas příchodu i odchodu.' }, { status: 400 })
      }

      // startTime/endTime may be UTC ISO strings (new clients) or legacy "HH:MM"
      const isIso = startTime.includes('T')
      const startMs = isIso ? new Date(startTime).getTime() : (() => { const [h, m] = startTime.split(':').map(Number); return h * 3600000 + m * 60000 })()
      const endMs = isIso ? new Date(endTime).getTime() : (() => { const [h, m] = endTime.split(':').map(Number); return h * 3600000 + m * 60000 })()

      if (endMs <= startMs) {
        return NextResponse.json({ ok: false, error: 'Čas odchodu musí být po čase příchodu.' }, { status: 422 })
      }

      // Overlap check — allow multiple records per day as long as times don't overlap
      const { data: existingLogs } = await supabase
        .from('attendance_logs')
        .select('id, check_in, check_out')
        .eq('organization_id', orgId)
        .eq('employee_id', employee.id)
        .eq('date', date)
        .not('check_out', 'is', null)

      for (const log of (existingLogs ?? []) as { id: string; check_in: string; check_out: string }[]) {
        const exStart = new Date(log.check_in).getTime()
        const exEnd = new Date(log.check_out).getTime()
        if (startMs < exEnd && endMs > exStart) {
          return NextResponse.json(
            { ok: false, error: `Záznam se překrývá s existujícím záznamem pro ${date}.` },
            { status: 409 }
          )
        }
      }

      const checkIn = isIso ? startTime : `${date}T${startTime}:00`
      const checkOut = isIso ? endTime : `${date}T${endTime}:00`
      const totalMins = Math.round((endMs - startMs) / 60000)
      const durationHours = Math.round(totalMins / 6) / 10
      const h = Math.floor(totalMins / 60)
      const m = totalMins % 60
      const durationLabel = m > 0 ? `${h}h ${m}m` : `${h}h`

      const insertData: Record<string, unknown> = {
        organization_id: orgId,
        employee_id: employee.id,
        date,
        check_in: checkIn,
        check_out: checkOut,
        note: note ?? null,
        work_type_name: workTypeName ?? 'HomeOffice',
      }
      if (workTypeId) insertData.work_type_id = workTypeId

      const { error: insertError } = await supabase.from('attendance_logs').insert(insertData)
      if (insertError) {
        console.error('Kiosk ho-record error:', insertError)
        return NextResponse.json({ ok: false, error: 'Chyba při zápisu záznamu.' }, { status: 500 })
      }

      return NextResponse.json({ ok: true, durationHours, durationLabel })
    }

    // ── action === 'checkout' ──────────────────────────────────────────────
    const { data: log, error: logError } = await supabase
      .from('attendance_logs')
      .select('id, check_in, work_type_name')
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
      logId: log.id,
      employee: { name: employee.name },
      duration: durationLabel,
      workTypeName: (log as unknown as { work_type_name?: string }).work_type_name ?? null,
    })
  } catch (err) {
    console.error('Kiosk route error:', err)
    return NextResponse.json({ ok: false, error: 'Interní chyba serveru' }, { status: 500 })
  }
}
