// lib/finance/retirement/request.ts
// Shared bits of the retirement and insurance routes: the signed-in user (RLS session client),
// the date "today" means, and turning a RetirementError into a response.
//
// "Today" is the person's local date when the page sends it (?today=YYYY-MM-DD); otherwise the
// server's local date. It only moves the projection's start and the premium due dates.

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { todayLocal } from '@/lib/dates/local';
import { isDateString } from '@/lib/finance/savings/logic';
import { RetirementError } from './server';

export function resolveToday(value: unknown): string {
  return isDateString(value) ? value : todayLocal();
}

export async function sessionUser(): Promise<{ db: SupabaseClient; userId: string | null }> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  return { db, userId: user?.id ?? null };
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new RetirementError('The request body must be JSON.');
  }
}

export function errorResponse(err: unknown, where: string): NextResponse {
  if (err instanceof RetirementError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error(`[${where}]`, err instanceof Error ? err.message : 'Unknown error');
  return NextResponse.json({ error: 'Something went wrong. Nothing was changed.' }, { status: 500 });
}
