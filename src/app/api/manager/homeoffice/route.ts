import { NextRequest, NextResponse } from 'next/server'
import { resolveOrgId } from '@/lib/resolveOrg'

function isHO(name: string | null | undefined): boolean {
  if (!name) return false
  const n = name.toLowerCase().replace(/\s+/g, '')
  return n === 'ho' || n === 'homeoffice'
}

// GET /api/manager/homeoffice?month=YYYY-MM
// Returns:
//   logs    — HO attendance logs for the given month (completed + in-progress)
//   current — people currently checked in to HO right now (check_out IS NULL, today)
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase } = resolved

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM

  // ── Monthly logs ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('attendance_logs')
    .select('id, employee_id, date, check_in, check_out, note, work_type_name, employees(id, name)')
    .eq('organization_id', orgId)
    .order('date', { ascending: false })
    .order('check_in', { ascending: false })

  if (month) {
    const [year, mon] = month.split('-').map(Number)
    const first = `${month}-01`
    const last = new Date(year, mon, 0).toISOString().slice(0, 10)
    query = query.gte('date', first).lte('date', last)
  }

  // ── Current HO presence (open sessions today) ─────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: liveData } = await (supabase as any)
    .from('attendance_logs')
    .select('id, employee_id, check_in, work_type_name, employees(id, name)')
    .eq('organization_id', orgId)
    .eq('date', today)
    .not('check_in', 'is', null)
    .is('check_out', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = (data ?? []).filter((row: any) => isHO(row.work_type_name)).map((row: any) => {
    const checkIn = row.check_in ? new Date(row.check_in) : null
    const checkOut = row.check_out ? new Date(row.check_out) : null
    const durationMinutes = checkIn && checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : null
    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeName: (row.employees as { name?: string } | null)?.name ?? '—',
      date: row.date,
      checkIn: row.check_in,
      checkOut: row.check_out,
      durationMinutes,
      note: row.note ?? null,
      workTypeName: row.work_type_name,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = (liveData ?? []).filter((row: any) => isHO(row.work_type_name)).map((row: any) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: (row.employees as { name?: string } | null)?.name ?? '—',
    checkIn: row.check_in,
  }))

  return NextResponse.json({ logs, current })
}
