import { isTokenValid, getServiceClient } from './managerAuth'
import { createClient } from './supabase/server'

type ServiceClient = ReturnType<typeof getServiceClient>

type ResolveResult =
  | {
      orgId: string
      supabase: ServiceClient
      isAdmin: boolean
      departments: string[] | null
      permissions: string[]
    }
  | { error: string; status: number }

export async function resolveOrgId(req: { headers: { get(k: string): string | null } }): Promise<ResolveResult> {
  const managerToken = req.headers.get('Manager-Token')
  if (managerToken) {
    const result = isTokenValid(managerToken)
    if (!result.valid) return { error: 'Token manažera je neplatný nebo vypršel.', status: 401 }
    return {
      orgId: result.orgId,
      supabase: getServiceClient() as ServiceClient,
      isAdmin: result.role === 'admin',
      departments: result.departments,
      permissions: result.permissions,
    }
  }

  // Fall back to Supabase session (internal users are always admin-scoped)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nepřihlášený uživatel.', status: 401 }

  const serviceClient = getServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return { error: 'Organizace nenalezena.', status: 404 }

  return {
    orgId: profile.organization_id,
    supabase: serviceClient as ServiceClient,
    isAdmin: true,
    departments: null,
    permissions: [],
  }
}
