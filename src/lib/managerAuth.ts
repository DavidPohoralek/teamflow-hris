import { createClient } from '@supabase/supabase-js'

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000

export function isTokenValid(token: string): { valid: false } | { valid: true; orgId: string } {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const colonIdx = decoded.lastIndexOf(':')
    if (colonIdx < 0) return { valid: false }
    const orgId = decoded.slice(0, colonIdx)
    const timestamp = parseInt(decoded.slice(colonIdx + 1), 10)
    if (!orgId || isNaN(timestamp)) return { valid: false }
    const elapsed = new Date().getTime() - timestamp
    if (elapsed > SESSION_DURATION_MS || elapsed < 0) return { valid: false }
    return { valid: true, orgId }
  } catch {
    return { valid: false }
  }
}

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
