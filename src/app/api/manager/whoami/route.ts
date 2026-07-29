import { NextRequest, NextResponse } from 'next/server'
import { resolveOrgId } from '@/lib/resolveOrg'

// GET /api/manager/whoami — who is the logged-in manager?
// Lets the client tailor the bonus UI (owner sees the manager-bonus window + overview).
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { orgId, supabase, isAdmin, departments, employeeId } = resolved

  let isOwner = false
  let name: string | null = null
  if (employeeId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('employees')
      .select('name, is_owner')
      .eq('id', employeeId)
      .eq('organization_id', orgId)
      .maybeSingle()
    isOwner = Boolean(data?.is_owner)
    name = data?.name ?? null
  }
  // Admins act as owner too (full oversight)
  if (isAdmin) isOwner = true

  return NextResponse.json({ isAdmin, isOwner, employeeId, name, departments })
}
