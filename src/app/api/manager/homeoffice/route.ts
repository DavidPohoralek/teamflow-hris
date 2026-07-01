import { NextRequest, NextResponse } from 'next/server'
import { resolveOrgId } from '@/lib/resolveOrg'

function isHO(name: string | null | undefined): boolean {
  if (!name) return false
  const n = name.toLowerCase().replace(/\s+/g, '')
  return n === 'ho' || n === 'homeoffice'
}

// GET /api/manager/homeoffice?month=YYYY-MM
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase } = resolved

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM

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

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter to HomeOffice rows (work_type_name = 'HO' | 'HomeOffice' | 'Home Office')
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

  return NextResponse.json({ logs })
}
