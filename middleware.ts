import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';

  // dotaznik.tmflw.com → serve /dotaznik internally
  if (host.startsWith('dotaznik.')) {
    const url = request.nextUrl.clone();
    if (!url.pathname.startsWith('/dotaznik') && !url.pathname.startsWith('/api/dotaznik')) {
      url.pathname = '/dotaznik' + (url.pathname === '/' ? '' : url.pathname);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
