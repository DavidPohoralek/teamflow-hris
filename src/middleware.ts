import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
