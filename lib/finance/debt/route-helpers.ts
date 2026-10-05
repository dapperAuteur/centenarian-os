// lib/finance/debt/route-helpers.ts
// Shared plumbing for app/api/finance/debt/*: the signed-in user, the service-role client, and
// turning thrown errors into JSON.

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { DebtDbError } from './server.ts';

/** Service role: RLS is bypassed, so every query filters by user_id explicitly. */
export function getServiceDb(): SupabaseClient {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** The signed-in user's id, or null. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function errorResponse(err: unknown, where: string) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error(`[${where}]`, message);
  const status = err instanceof DebtDbError ? err.status : 500;
  return NextResponse.json({ error: message }, { status });
}
