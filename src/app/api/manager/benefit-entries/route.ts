import { NextRequest, NextResponse } from 'next/server'
import { resolveOrgId } from '@/lib/resolveOrg'

// GET /api/manager/benefit-entries?month=YYYY-MM
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase, departments } = resolved

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data, error } = await sb
    .from('benefit_entries')
    .select('id, benefit_key, date, created_at, employees ( id, name, department )')
    .eq('organization_id', orgId)
    .gte('date', month + '-01')
    .lte('date', month + '-31')
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter by manager's departments if scoped
  const rows = (data ?? []).filter((r: { employees: { department: string | null } | null }) => {
    if (!departments || departments.length === 0) return true
    return departments.includes(r.employees?.department ?? '')
  })

  return NextResponse.json({ entries: rows })
}

// DELETE /api/manager/benefit-entries?entryId=UUID
export async function DELETE(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase } = resolved

  const { searchParams } = new URL(req.url)
  const entryId = searchParams.get('entryId')
  if (!entryId) return NextResponse.json({ error: 'Chybí entryId.' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: existing } = await sb
    .from('benefit_entries')
    .select('id, benefit_key, date, employee_id')
    .eq('id', entryId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Záznam nenalezen.' }, { status: 404 })

  await sb.from('benefit_entries').delete().eq('id', entryId)

  // Sync benefit_logs count for that month
  const month = (existing.date as string).slice(0, 7)
  const { count } = await sb
    .from('benefit_entries')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('employee_id', existing.employee_id)
    .eq('benefit_key', existing.benefit_key)
    .gte('date', month + '-01')
    .lte('date', month + '-31')

  await sb
    .from('employee_benefit_logs')
    .upsert(
      { organization_id: orgId, employee_id: existing.employee_id, month, benefit_key: existing.benefit_key, count: count ?? 0, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id,employee_id,month,benefit_key' }
    )

  return NextResponse.json({ ok: true })
}
