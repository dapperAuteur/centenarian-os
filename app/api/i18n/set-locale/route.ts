// app/api/i18n/set-locale/route.ts
// Client-facing endpoint to persist the user's locale choice. Minimal:
// POST { locale } → cookie written → client refreshes the page (or
// reloads whatever component needs to re-render).
//
// Plan 31 Phase 1.

import { NextRequest, NextResponse } from 'next/server';
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isSupportedLocale,
} from '@/lib/i18n/config';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { locale } = body as { locale?: unknown };

  if (typeof locale !== 'string' || !isSupportedLocale(locale)) {
    return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set({
    name: LOCALE_COOKIE,
    value: locale,
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
