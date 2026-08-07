import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000 // 12 hours

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

// HMAC secret — dedicated env var when set, otherwise derived from the
// service-role key (server-only, never shipped to the client).
function tokenSecret(): string {
  const secret = process.env.MANAGER_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Chybí MANAGER_TOKEN_SECRET / SUPABASE_SERVICE_ROLE_KEY')
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', tokenSecret()).update(payload).digest('hex')
}

// Token format v3 (signed): base64(orgId|employeeId|role|departments|permissions|timestamp).hmacSha256Hex
//
// Unsigned v1/v2 tokens are rejected outright — the payload is client-held, so
// without a signature anyone who knew an orgId (present in every public kiosk
// URL) could mint themselves an admin token.
export function isTokenValid(token: string): TokenResult {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return { valid: false } // legacy unsigned token → re-login

    const b64 = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    const payload = Buffer.from(b64, 'base64').toString('utf-8')

    const sigBuf = Buffer.from(sig, 'hex')
    const expectedBuf = Buffer.from(sign(payload), 'hex')
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false }
    }

    const parts = payload.split('|')
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
  } catch {
    return { valid: false }
  }
}

/**
 * Full verification: signature + expiry, and for manager tokens a DB
 * revalidation — role and scope come from the CURRENT employee row, so
 * deactivating an employee or narrowing their departments takes effect on the
 * next request, not up to 12 hours later.
 */
export async function verifyManagerToken(token: string): Promise<TokenResult> {
  const result = isTokenValid(token)
  if (!result.valid || result.role !== 'manager') return result

  if (!result.employeeId) return { valid: false }
  const { data: emp } = await getServiceClient()
    .from('employees')
    .select('active, is_manager, managed_departments, manager_permissions')
    .eq('id', result.employeeId)
    .eq('organization_id', result.orgId)
    .maybeSingle()

  if (!emp || !emp.active || !emp.is_manager) return { valid: false }

  const deps = (emp.managed_departments as string[] | null) ?? []
  return {
    ...result,
    // Same semantics as token minting: empty list = no department filter
    departments: deps.length > 0 ? deps : null,
    permissions: (emp.manager_permissions as string[] | null) ?? [],
  }
}

function buildToken(payload: string): string {
  return `${Buffer.from(payload).toString('base64')}.${sign(payload)}`
}

export function buildAdminToken(orgId: string): string {
  return buildToken([orgId, '', 'admin', '', '', Date.now()].join('|'))
}

export function buildManagerToken(
  orgId: string,
  employeeId: string,
  departments: string[],
  permissions: string[],
): string {
  return buildToken([
    orgId,
    employeeId,
    'manager',
    departments.join(','),
    permissions.join(','),
    Date.now(),
  ].join('|'))
}

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
