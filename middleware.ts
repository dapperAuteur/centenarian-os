// File: middleware.ts
// Protects dashboard routes, refreshes auth tokens

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Contractor subdomain: allowed route prefixes (everything else redirects to hub)
const CONTRACTOR_ALLOWED = [
  '/dashboard/contractor',
  '/dashboard/finance/invoices',
  '/dashboard/finance/transactions',
  '/dashboard/finance/accounts',
  '/dashboard/travel',
  '/dashboard/equipment',
  '/dashboard/contacts',
  '/dashboard/settings',
  '/dashboard/billing',
  '/dashboard/messages',
  '/dashboard/feedback',
  '/dashboard/scan',
  '/dashboard/data',
  '/api/',
  '/login',
  '/signup',
];

// Lister subdomain: allowed route prefixes
const LISTER_ALLOWED = [
  '/dashboard/contractor/lister',
  '/dashboard/contractor/jobs',
  '/dashboard/contractor/reports',
  '/dashboard/contractor/venues',
  '/dashboard/contractor/cities',
  '/dashboard/settings',
  '/dashboard/billing',
  '/dashboard/messages',
  '/dashboard/feedback',
  '/api/',
  '/login',
  '/signup',
];

function isSubdomainAllowed(pathname: string, allowed: string[]): boolean {
  if (pathname === '/dashboard' || pathname === '/') return true;
  return allowed.some((p) => pathname === p || pathname.startsWith(p + '/') || (p.endsWith('/') && pathname.startsWith(p)));
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const isContractorMode = hostname.startsWith('contractor.');

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

  // ── Subdomain handling ────────────────────────────────────────────
  const isListerMode = hostname.startsWith('lister.');

  if (isContractorMode) {
    response.headers.set('x-app-mode', 'contractor');

    // Unauthenticated: serve landing/pricing pages
    if (!user) {
      if (pathname === '/') {
        const url = request.nextUrl.clone();
        url.pathname = '/contractor-landing';
        return NextResponse.rewrite(url, { headers: response.headers });
      }
      if (pathname === '/pricing') {
        const url = request.nextUrl.clone();
        url.pathname = '/contractor-pricing';
        return NextResponse.rewrite(url, { headers: response.headers });
      }
    }

    // Allow landing/pricing routes through (even if authenticated, for direct access)
    if (pathname === '/contractor-landing' || pathname === '/contractor-pricing') {
      return response;
    }

    if (pathname === '/' || pathname === '/dashboard') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard/contractor';
      return NextResponse.rewrite(url, { headers: response.headers });
    }

    if (pathname.startsWith('/dashboard') && !isSubdomainAllowed(pathname, CONTRACTOR_ALLOWED)) {
      return NextResponse.redirect(new URL('/dashboard/contractor', request.url));
    }
  }

  if (isListerMode) {
    response.headers.set('x-app-mode', 'lister');

    // Unauthenticated: serve landing/pricing pages
    if (!user) {
      if (pathname === '/') {
        const url = request.nextUrl.clone();
        url.pathname = '/lister-landing';
        return NextResponse.rewrite(url, { headers: response.headers });
      }
      if (pathname === '/pricing') {
        const url = request.nextUrl.clone();
        url.pathname = '/lister-pricing';
        return NextResponse.rewrite(url, { headers: response.headers });
      }
    }

    // Allow landing/pricing routes through
    if (pathname === '/lister-landing' || pathname === '/lister-pricing') {
      return response;
    }

    if (pathname === '/' || pathname === '/dashboard') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard/contractor/lister';
      return NextResponse.rewrite(url, { headers: response.headers });
    }

    if (pathname.startsWith('/dashboard') && !isSubdomainAllowed(pathname, LISTER_ALLOWED)) {
      return NextResponse.redirect(new URL('/dashboard/contractor/lister', request.url));
    }
  }

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