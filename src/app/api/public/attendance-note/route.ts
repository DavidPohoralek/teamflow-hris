import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  return createClient((process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// PATCH /api/public/attendance-note
// Body: { logId, orgId, pin, note }
// Saves HomeOffice activity note to an attendance_log row (PIN-verified)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { logId?: string; orgId?: string; pin?: string; note?: string }
    const { logId, orgId, pin, note } = body

    if (!logId || !orgId || !pin) {
      return NextResponse.json({ error: 'Chybí parametry.' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Verify PIN → employee
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('organization_id', orgId)
      .eq('pin_code', pin)
      .eq('active', true)
      .maybeSingle()

    if (!emp) return NextResponse.json({ error: 'Neplatný PIN.' }, { status: 401 })

    // Verify log belongs to this employee
    const { data: log } = await supabase
      .from('attendance_logs')
      .select('employee_id')
      .eq('id', logId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!log || log.employee_id !== emp.id) {
      return NextResponse.json({ error: 'Záznam nenalezen.' }, { status: 404 })
    }

    const { error } = await supabase
      .from('attendance_logs')
      .update({ note: note?.trim() ?? null })
      .eq('id', logId)

    if (error) return NextResponse.json({ error: 'Nepodařilo se uložit zprávu.' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Interní chyba.' }, { status: 500 })
  }
}
