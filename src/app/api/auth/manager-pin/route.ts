import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { buildManagerToken } from '@/lib/managerAuth'

function getServiceClient() {
  return createClient((process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/auth/manager-pin
// Body: { orgId: string, pin: string }
// Returns { ok: true, token } on success
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { orgId?: string; pin?: string }
    const { orgId, pin } = body

    if (!orgId || !pin) {
      return NextResponse.json({ ok: false, error: 'Chybí parametry orgId nebo pin.' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { data: emp } = await supabase
      .from('employees')
      .select('id, is_manager, managed_departments, manager_permissions')
      .eq('organization_id', orgId)
      .or(`pin_code.eq.${pin},pin.eq.${pin}`)
      .eq('active', true)
      .eq('is_manager', true)
      .maybeSingle()

    if (!emp) {
      return NextResponse.json(
        { ok: false, error: 'Neplatný PIN nebo zaměstnanec nemá manažerská oprávnění.' },
        { status: 401 }
      )
    }

    const token = buildManagerToken(
      orgId,
      emp.id as string,
      (emp.managed_departments as string[] | null) ?? [],
      (emp.manager_permissions as string[] | null) ?? [],
    )

    return NextResponse.json({ ok: true, token })
  } catch (err) {
    console.error('manager-pin route error:', err)
    return NextResponse.json({ ok: false, error: 'Interní chyba serveru.' }, { status: 500 })
  }
}
