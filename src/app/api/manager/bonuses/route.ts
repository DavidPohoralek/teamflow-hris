import { NextRequest, NextResponse } from 'next/server'
import { resolveOrgId } from '@/lib/resolveOrg'

type ScopedResolve = {
  orgId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any
  departments: string[] | null
}

function inScope(departments: string[] | null, dept: string | null | undefined): boolean {
  if (!departments || departments.length === 0) return true
  return departments.includes(dept ?? '')
}

// Is the logged-in manager the owner? (owner = employees.is_owner, or an admin)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveIsOwner(sb: any, orgId: string, employeeId: string | null, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true
  if (!employeeId) return false
  const { data } = await sb.from('employees').select('is_owner').eq('id', employeeId).eq('organization_id', orgId).maybeSingle()
  return Boolean(data?.is_owner)
}

// GET /api/manager/bonuses?month=YYYY-MM   → entries for the month (scoped)
// GET /api/manager/bonuses?summary=1       → per-month totals for the manager's scope
// GET /api/manager/bonuses?budget=1&month= → budget for the manager's scope
// GET /api/manager/bonuses?scope=all&month= → owner: all bonuses + per-department breakdown
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase, departments, employeeId, isAdmin } = resolved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { searchParams } = new URL(req.url)

  // ── Budget per department ───────────────────────────────────────────────────
  if (searchParams.get('budget') === '1') {
    const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

    const { data: settingsRow } = await sb
      .from('company_settings').select('extra_settings').eq('organization_id', orgId).maybeSingle()
    const extra = (settingsRow?.extra_settings ?? {}) as Record<string, unknown>
    const rate = Number(extra['bonus_budget_per_person']) > 0 ? Number(extra['bonus_budget_per_person']) : 500

    const { data: emps } = await sb
      .from('employees').select('id, department, is_manager').eq('organization_id', orgId).eq('active', true)
    const eligible = (emps ?? []).filter((e: { department: string | null; is_manager?: boolean }) =>
      inScope(departments, e.department) && !e.is_manager)

    const { data: bonusRows } = await sb
      .from('employee_bonuses').select('amount, employees ( department )')
      .eq('organization_id', orgId).eq('month', month)
    const allBonuses = ((bonusRows ?? []) as { amount: number; employees: { department: string | null } | null }[])
      .filter(r => inScope(departments, r.employees?.department))

    // Group by department
    const deptMap = new Map<string, { headcount: number; spent: number }>()
    for (const e of eligible) {
      const dept = e.department ?? ''
      if (!deptMap.has(dept)) deptMap.set(dept, { headcount: 0, spent: 0 })
      deptMap.get(dept)!.headcount++
    }
    for (const b of allBonuses) {
      const dept = b.employees?.department ?? ''
      if (!deptMap.has(dept)) deptMap.set(dept, { headcount: 0, spent: 0 })
      deptMap.get(dept)!.spent += Number(b.amount) || 0
    }

    const byDepartment: Record<string, { budget: number; spent: number; headcount: number; rate: number }> = {}
    Array.from(deptMap.entries()).forEach(([dept, v]) => {
      byDepartment[dept || '__none__'] = {
        budget: v.headcount * rate,
        spent: Math.round(v.spent * 100) / 100,
        headcount: v.headcount,
        rate,
      }
    })

    return NextResponse.json({ byDepartment, rate })
  }

  // ── Owner overview: all bonuses across the org ─────────────────────────────
  if (searchParams.get('scope') === 'all') {
    if (!(await resolveIsOwner(sb, orgId, employeeId, isAdmin))) {
      return NextResponse.json({ error: 'Přehled všech bonusů má jen majitel.' }, { status: 403 })
    }
    const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
    const { data, error } = await sb
      .from('employee_bonuses')
      .select('id, employee_id, month, amount, note, granted_by, created_at, employees ( id, name, department, is_manager )')
      .eq('organization_id', orgId).eq('month', month).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bonuses: data ?? [] })
  }

  if (searchParams.get('summary') === '1') {
    const { data, error } = await sb
      .from('employee_bonuses')
      .select('month, amount, employees ( department )')
      .eq('organization_id', orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const byMonth = new Map<string, { total: number; count: number }>()
    for (const r of (data ?? []) as { month: string; amount: number; employees: { department: string | null } | null }[]) {
      if (!inScope(departments, r.employees?.department)) continue
      const agg = byMonth.get(r.month) ?? { total: 0, count: 0 }
      agg.total += Number(r.amount) || 0
      agg.count += 1
      byMonth.set(r.month, agg)
    }
    const summary = Array.from(byMonth.entries())
      .map(([month, agg]) => ({ month, total: Math.round(agg.total * 100) / 100, count: agg.count }))
      .sort((a, b) => b.month.localeCompare(a.month))

    return NextResponse.json({ summary })
  }

  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Neplatný měsíc.' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('employee_bonuses')
    .select('id, employee_id, month, amount, note, granted_by, created_at, employees ( id, name, department )')
    .eq('organization_id', orgId)
    .eq('month', month)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).filter((r: { employees: { department: string | null } | null }) =>
    inScope(departments, r.employees?.department))

  return NextResponse.json({ bonuses: rows })
}

// Shared guard for mutations: employee must exist in org and manager's scope
async function checkEmployee({ orgId, sb, departments }: ScopedResolve, employeeId: string) {
  const { data: emp } = await sb
    .from('employees')
    .select('id, name, department')
    .eq('id', employeeId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!emp) return { error: NextResponse.json({ error: 'Zaměstnanec nenalezen.' }, { status: 404 }) }
  if (!inScope(departments, emp.department)) {
    return { error: NextResponse.json({ error: 'Tento zaměstnanec nepatří do vašich oddělení.' }, { status: 403 }) }
  }
  return { emp }
}

// POST /api/manager/bonuses
// Body: { employee_id, month: 'YYYY-MM', amount: number > 0, note?: string }
// Adds a new bonus entry — multiple entries per employee+month are allowed.
export async function POST(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase, departments, employeeId: managerEmployeeId, isAdmin } = resolved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

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
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Částka musí být kladné číslo.' }, { status: 422 })
  }

  // Owner may bonus anyone (incl. managers) — bypass the department scope.
  const isOwner = await resolveIsOwner(sb, orgId, managerEmployeeId, isAdmin)
  if (isOwner) {
    const { data: emp } = await sb.from('employees').select('id').eq('id', employee_id).eq('organization_id', orgId).maybeSingle()
    if (!emp) return NextResponse.json({ error: 'Zaměstnanec nenalezen.' }, { status: 404 })
  } else {
    const check = await checkEmployee({ orgId, sb, departments }, employee_id)
    if ('error' in check) return check.error
  }

  let grantedBy = isAdmin ? 'Administrátor' : 'Manažer'
  if (managerEmployeeId) {
    const { data: mgr } = await sb.from('employees').select('name').eq('id', managerEmployeeId).maybeSingle()
    if (mgr?.name) grantedBy = mgr.name
  }

  const { data: saved, error } = await sb
    .from('employee_bonuses')
    .insert({
      organization_id: orgId,
      employee_id,
      month,
      amount,
      note: note?.trim() || null,
      granted_by: grantedBy,
    })
    .select('id, employee_id, month, amount, note, granted_by, created_at')
    .single()

  if (error) {
    console.error('POST /api/manager/bonuses error:', error)
    return NextResponse.json({ error: 'Nepodařilo se uložit bonus.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, bonus: saved }, { status: 201 })
}

// DELETE /api/manager/bonuses?id=UUID — remove a single bonus entry
export async function DELETE(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase, departments, employeeId, isAdmin } = resolved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Chybí id.' }, { status: 400 })

  const { data: existing } = await sb
    .from('employee_bonuses')
    .select('id, employee_id, employees ( department )')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Záznam nenalezen.' }, { status: 404 })
  const isOwner = await resolveIsOwner(sb, orgId, employeeId, isAdmin)
  if (!isOwner && !inScope(departments, existing.employees?.department)) {
    return NextResponse.json({ error: 'Tento záznam nepatří do vašich oddělení.' }, { status: 403 })
  }

  await sb.from('employee_bonuses').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
