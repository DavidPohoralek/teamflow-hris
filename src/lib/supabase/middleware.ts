import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect dashboard routes
  const url = request.nextUrl.clone();
  const isAuthRoute =
    url.pathname.startsWith('/login') || url.pathname.startsWith('/register');
  const isDashboardRoute = url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/employees') ||
    url.pathname.startsWith('/shifts') ||
    url.pathname.startsWith('/attendance') ||
    url.pathname.startsWith('/requests') ||
    url.pathname.startsWith('/settings');

  if (!user && isDashboardRoute) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // NOTE: We intentionally do NOT redirect authenticated users away from /login.
  // Doing so creates a redirect loop when cookies appear valid but the session is
  // actually broken — the user can never reach the login form to fix it.
  // The login page handles the "already logged in" case client-side instead.

  return supabaseResponse;
}
