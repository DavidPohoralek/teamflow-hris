import { NextRequest, NextResponse } from 'next/server'
import { resolveOrgId } from '@/lib/resolveOrg'

// GET /api/manager/open-sessions
// Attendance logs with a check-in but no check-out from PAST days (today's open
// sessions are people currently at work — not listed). Scoped by departments.
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase, departments } = resolved

  const today = new Date().toISOString().slice(0, 10)
  const fence = new Date()
  fence.setDate(fence.getDate() - 60)
  const fenceISO = fence.toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data, error } = await sb
    .from('attendance_logs')
    .select('id, employee_id, date, check_in, work_type_name, note, employees ( id, name, department )')
    .eq('organization_id', orgId)
    .not('check_in', 'is', null)
    .is('check_out', null)
    .lt('date', today)
    .gte('date', fenceISO)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).filter((r: { employees: { department: string | null } | null }) => {
    if (!departments || departments.length === 0) return true
    return departments.includes(r.employees?.department ?? '')
  })

  return NextResponse.json({ sessions: rows })
}
