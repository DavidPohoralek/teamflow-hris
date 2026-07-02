const MANAGER_SESSION_KEY = 'hris_manager_session'

export interface ManagerScope {
  isAdmin: boolean
  role: 'admin' | 'manager'
  /** null = all departments; string[] = restricted to these departments */
  departments: string[] | null
  permissions: string[]
  employeeId: string | null
}

export function getManagerToken(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(MANAGER_SESSION_KEY) } catch { return null }
}

export function getManagerScope(): ManagerScope | null {
  const token = getManagerToken()
  if (!token) return null
  try {
    const decoded = atob(token)
    if (decoded.includes('|')) {
      const parts = decoded.split('|')
      if (parts.length < 6) return null
      const [, employeeId, role, depsStr, permsStr] = parts
      return {
        isAdmin: role !== 'manager',
        role: role === 'manager' ? 'manager' : 'admin',
        departments: depsStr ? depsStr.split(',').filter(Boolean) : null,
        permissions: permsStr ? permsStr.split(',').filter(Boolean) : [],
        employeeId: employeeId || null,
      }
    }
    // Legacy v1 token (orgId:timestamp) = admin, no scope restrictions
    return { isAdmin: true, role: 'admin', departments: null, permissions: [], employeeId: null }
  } catch {
    return null
  }
}

export async function managerFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getManagerToken()
  const headers: Record<string, string> = {}
  const existing = options.headers
  if (existing) {
    if (existing instanceof Headers) {
      existing.forEach((v, k) => { headers[k] = v })
    } else if (Array.isArray(existing)) {
      (existing as [string, string][]).forEach(([k, v]) => { headers[k] = v })
    } else {
      Object.assign(headers, existing as Record<string, string>)
    }
  }
  if (token) headers['Manager-Token'] = token
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  return fetch(url, { ...options, headers })
}
