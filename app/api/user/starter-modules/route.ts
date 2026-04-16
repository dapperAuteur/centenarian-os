// app/api/user/starter-modules/route.ts
//
// PATCH — update an active Starter subscriber's selected modules.
// Body: { selected_modules: string[] }  // exactly 3 valid slugs
//
// Auth: signed-in user with subscription_status='starter'. We do NOT
// allow other tiers to set this column — Lifetime / Monthly tiers
// aren't module-gated and storing a value there would be misleading.
//
// No billing interaction: per owner decision §16.9, Starter users can
// swap modules any time, as many times as they want, with no billing-
// cycle restriction. Change history is not kept.

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isValidStarterSelection } from '@/lib/access/starter-modules';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { selected_modules } = body as { selected_modules?: unknown };

  if (!Array.isArray(selected_modules) || !selected_modules.every((s) => typeof s === 'string')) {
    return NextResponse.json({ error: 'selected_modules must be an array of strings' }, { status: 400 });
  }
  if (!isValidStarterSelection(selected_modules as string[])) {
    return NextResponse.json(
      { error: 'Selection must be exactly 3 unique valid module slugs' },
      { status: 400 },
    );
  }

  const db = getDb();

  // Enforce that only active Starter subscribers can change their picks.
  const { data: profile, error: readErr } = await db
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!profile || profile.subscription_status !== 'starter') {
    return NextResponse.json(
      { error: 'Only Starter subscribers can change their picked modules.' },
      { status: 403 },
    );
  }

  const { error: updateErr } = await db
    .from('profiles')
    .update({ selected_modules })
    .eq('id', user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, selected_modules });
}
