const MANAGER_SESSION_KEY = 'hris_manager_session'

export function getManagerToken(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(MANAGER_SESSION_KEY) } catch { return null }
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
