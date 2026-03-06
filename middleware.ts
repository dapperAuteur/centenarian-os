// File: middleware.ts
// Protects dashboard routes, refreshes auth tokens

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // MFA enforcement — if user has MFA enrolled but hasn't verified yet, redirect to login
  if (user && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin'))) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
      const mfaUrl = new URL('/login', request.url);
      mfaUrl.searchParams.set('mfa', 'pending');
      return NextResponse.redirect(mfaUrl);
    }
  }

  // Admin guard — must be authenticated AND match ADMIN_EMAIL
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/dashboard/planner', request.url));
    }
    return response;
  }

  // AI tools — admin only (public /coaching page is open to all)
  const adminOnlyPaths = ['/dashboard/coach', '/dashboard/gems'];
  if (adminOnlyPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/dashboard/planner', request.url));
    }
    return response;
  }

  // Redirect to login if not authenticated on dashboard routes
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to dashboard if authenticated and on auth pages
  if (user && (pathname === '/login' || pathname === '/signup')) {
    // Don't redirect away from login if MFA verification is pending
    if (pathname === '/login' && request.nextUrl.searchParams.get('mfa') === 'pending') {
      return response;
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/login', '/signup', '/blog/:path*', '/recipes', '/recipes/:path*'],
};