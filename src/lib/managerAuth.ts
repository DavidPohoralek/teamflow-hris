import { createClient } from '@supabase/supabase-js'

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours

export type TokenResult =
  | { valid: false }
  | {
      valid: true
      orgId: string
      employeeId: string | null
      role: 'admin' | 'manager'
      /** null = no filter (admin sees all), string[] = restrict to these departments */
      departments: string[] | null
      permissions: string[]
    }

// Token format v2 (new):  base64(orgId|employeeId|role|departments|permissions|timestamp)
// Token format v1 (legacy): base64(orgId:timestamp)
export function isTokenValid(token: string): TokenResult {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')

    if (decoded.includes('|')) {
      // v2 format
      const parts = decoded.split('|')
      if (parts.length < 6) return { valid: false }
      const [orgId, employeeId, role, depsStr, permsStr, tsStr] = parts
      const timestamp = parseInt(tsStr, 10)
      if (!orgId || isNaN(timestamp)) return { valid: false }
      const elapsed = Date.now() - timestamp
      if (elapsed > SESSION_DURATION_MS || elapsed < 0) return { valid: false }
      return {
        valid: true,
        orgId,
        employeeId: employeeId || null,
        role: (role === 'manager' ? 'manager' : 'admin') as 'admin' | 'manager',
        departments: depsStr ? depsStr.split(',').filter(Boolean) : null,
        permissions: permsStr ? permsStr.split(',').filter(Boolean) : [],
      }
    }

    // v1 legacy format: orgId:timestamp
    const colonIdx = decoded.lastIndexOf(':')
    if (colonIdx < 0) return { valid: false }
    const orgId = decoded.slice(0, colonIdx)
    const timestamp = parseInt(decoded.slice(colonIdx + 1), 10)
    if (!orgId || isNaN(timestamp)) return { valid: false }
    const elapsed = Date.now() - timestamp
    if (elapsed > SESSION_DURATION_MS || elapsed < 0) return { valid: false }
    return { valid: true, orgId, employeeId: null, role: 'admin', departments: null, permissions: [] }
  } catch {
    return { valid: false }
  }
}

export function buildAdminToken(orgId: string): string {
  const payload = [orgId, '', 'admin', '', '', Date.now()].join('|')
  return Buffer.from(payload).toString('base64')
}

export function buildManagerToken(
  orgId: string,
  employeeId: string,
  departments: string[],
  permissions: string[],
): string {
  const payload = [
    orgId,
    employeeId,
    'manager',
    departments.join(','),
    permissions.join(','),
    Date.now(),
  ].join('|')
  return Buffer.from(payload).toString('base64')
}

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
