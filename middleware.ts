// File: middleware.ts
// Protects dashboard routes, refreshes auth tokens, and handles
// locale-prefixed public URLs (/en/* and /es/*) for plan 31 Phase 2.
//
// Locale handling is cheap (regex + header set); auth work is
// pathname-gated to the protected subtree so expanding the matcher
// to cover public pages doesn't balloon Supabase call volume.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isSupportedLocale,
} from '@/lib/i18n/config';

// Regex that captures `/en` or `/es` at the start of a path, optionally
// followed by the rest of the URL. Keep in sync with LOCALES.
const LOCALE_PREFIX_RE = new RegExp(`^/(${LOCALES.join('|')})(/.*)?$`);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Locale-prefix rewrite. Users can visit /es/pricing or /en/pricing;
  //    middleware strips the prefix (so the app routes resolve to the
  //    existing /pricing page) and sets an x-locale request header
  //    that getLocale() reads server-side. Cookie is also refreshed so
  //    subsequent un-prefixed requests preserve the choice.
  const localeMatch = pathname.match(LOCALE_PREFIX_RE);
  if (localeMatch) {
    const urlLocale = localeMatch[1];
    const restOfPath = localeMatch[2] ?? '/';
    if (isSupportedLocale(urlLocale)) {
      const rewrittenUrl = request.nextUrl.clone();
      rewrittenUrl.pathname = restOfPath;
      // Pass the locale to server components via request header.
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-locale', urlLocale);
      const rewritten = NextResponse.rewrite(rewrittenUrl, {
        request: { headers: requestHeaders },
      });
      // Refresh cookie so cross-request navigations keep the locale
      // even when the user clicks a non-prefixed internal link.
      rewritten.cookies.set({
        name: LOCALE_COOKIE,
        value: urlLocale,
        maxAge: LOCALE_COOKIE_MAX_AGE,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
      });
      return rewritten;
    }
    // Fallthrough: /en-US, /fr, etc. — not supported. Let the app
    // render its 404 rather than silently 200-ing with default locale.
  }

  // 2. For paths that don't need auth work, return early after locale
  //    handling. Plays the locale cookie forward with default value
  //    so the Accept-Language fallback stays idempotent.
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    pathname === '/signup';
  if (!isProtectedPath) {
    // No auth call needed. Public route, non-prefixed — pass through.
    return NextResponse.next({ request: { headers: request.headers } });
  }

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
    return NextResponse.redirect(new URL('/dashboard/planner', request.url));
  }

  return response;
}

export const config = {
  // Covers auth-protected subtree + all public routes that might use
  // a locale prefix. Excludes _next, api, static assets, and files
  // with extensions (favicons, images). Locale handling is cheap;
  // auth work is pathname-gated above so public pages don't hit
  // Supabase.
  matcher: [
    '/((?!_next/static|_next/image|api/|favicon|.*\\..*).*)',
  ],
};
