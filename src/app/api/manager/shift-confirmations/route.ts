import { NextRequest, NextResponse } from 'next/server'
import { resolveOrgId } from '@/lib/resolveOrg'

// GET /api/manager/shift-confirmations?month=YYYY-MM
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase, departments } = resolved

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'Chybí month' }, { status: 400 })

  // All active employees, optionally scoped by department
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let empQuery = (supabase as any)
    .from('employees')
    .select('id, name, department')
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('name')
  if (departments && departments.length > 0) {
    empQuery = empQuery.in('department', departments)
  }
  const { data: employees, error: empError } = await empQuery
  if (empError) return NextResponse.json({ error: empError.message }, { status: 500 })

  // Confirmations for this month
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: confirmations } = await (supabase as any)
    .from('shift_confirmations')
    .select('employee_id, confirmed_at')
    .eq('organization_id', orgId)
    .eq('month', month)

  const confirmedSet = new Set((confirmations ?? []).map((c: { employee_id: string }) => c.employee_id))
  const confirmedAtMap = new Map(
    (confirmations ?? []).map((c: { employee_id: string; confirmed_at: string }) => [c.employee_id, c.confirmed_at])
  )

  const result = (employees ?? []).map((emp: { id: string; name: string; department: string | null }) => ({
    id: emp.id,
    name: emp.name,
    department: emp.department,
    confirmed: confirmedSet.has(emp.id),
    confirmedAt: confirmedAtMap.get(emp.id) ?? null,
  }))

  return NextResponse.json({
    month,
    employees: result,
    confirmedCount: result.filter((e: { confirmed: boolean }) => e.confirmed).length,
    total: result.length,
  })
}
