import { NextRequest, NextResponse } from 'next/server'
import { resolveOrgId } from '@/lib/resolveOrg'

// GET /api/manager/bonuses?month=YYYY-MM
// Lists bonuses for the month, joined with employee info. Scoped managers see
// only their departments' employees.
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase, departments } = resolved

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Neplatný měsíc.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data, error } = await sb
    .from('employee_bonuses')
    .select('id, employee_id, month, amount, note, granted_by, updated_at, employees ( id, name, department )')
    .eq('organization_id', orgId)
    .eq('month', month)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).filter((r: { employees: { department: string | null } | null }) => {
    if (!departments || departments.length === 0) return true
    return departments.includes(r.employees?.department ?? '')
  })

  return NextResponse.json({ bonuses: rows })
}

// PUT /api/manager/bonuses
// Body: { employee_id, month: 'YYYY-MM', amount: number, note?: string }
// Upserts the bonus for employee+month. amount 0 clears it (row deleted).
export async function PUT(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase, departments, employeeId: managerEmployeeId, isAdmin } = resolved

  let body: { employee_id?: string; month?: string; amount?: number; note?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Neplatné tělo požadavku.' }, { status: 400 })
  }

  const { employee_id, month, amount, note } = body
  if (!employee_id || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Chybí employee_id nebo month.' }, { status: 400 })
  }
  if (typeof amount !== 'number' || !isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: 'Částka musí být nezáporné číslo.' }, { status: 422 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Target employee must exist in this org — and in the manager's departments when scoped
  const { data: emp } = await sb
    .from('employees')
    .select('id, name, department')
    .eq('id', employee_id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!emp) return NextResponse.json({ error: 'Zaměstnanec nenalezen.' }, { status: 404 })
  if (departments && departments.length > 0 && !departments.includes(emp.department ?? '')) {
    return NextResponse.json({ error: 'Tento zaměstnanec nepatří do vašich oddělení.' }, { status: 403 })
  }

  // Resolve who grants the bonus (manager's employee name, or admin)
  let grantedBy = isAdmin ? 'Administrátor' : 'Manažer'
  if (managerEmployeeId) {
    const { data: mgr } = await sb
      .from('employees')
      .select('name')
      .eq('id', managerEmployeeId)
      .maybeSingle()
    if (mgr?.name) grantedBy = mgr.name
  }

  if (amount === 0) {
    await sb
      .from('employee_bonuses')
      .delete()
      .eq('organization_id', orgId)
      .eq('employee_id', employee_id)
      .eq('month', month)
    return NextResponse.json({ ok: true, cleared: true })
  }

  const { data: saved, error } = await sb
    .from('employee_bonuses')
    .upsert(
      {
        organization_id: orgId,
        employee_id,
        month,
        amount,
        note: note?.trim() || null,
        granted_by: grantedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,employee_id,month' }
    )
    .select('id, employee_id, month, amount, note, granted_by, updated_at')
    .single()

  if (error) {
    console.error('PUT /api/manager/bonuses error:', error)
    return NextResponse.json({ error: 'Nepodařilo se uložit bonus.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, bonus: saved })
}
