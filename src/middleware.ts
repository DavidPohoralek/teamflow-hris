import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const url = req.nextUrl.clone()
  const { pathname } = url

  const isTicketDomain =
    host === 'ticket.tmflw.com' ||
    host.startsWith('ticket.localhost')

  if (
    isTicketDomain &&
    !pathname.startsWith('/ticket') &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/_next/')
  ) {
    url.pathname = '/ticket' + (pathname === '/' ? '' : pathname)
    return NextResponse.rewrite(url)
  }

  // Always run Supabase session refresh so auth cookies stay valid.
  // Wrap in try/catch: if Supabase is unreachable, pass the request through
  // rather than serving a 500 (which would show a blank/broken page).
  try {
    return await updateSession(req)
  } catch {
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
