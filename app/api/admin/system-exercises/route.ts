// app/api/admin/system-exercises/route.ts
// Admin-only: promote a user exercise to the shared system_exercises library

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getServiceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function getAdminUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => { try { cookieStore.set({ name, value, ...options }); } catch {} },
        remove: (name: string, options: CookieOptions) => { try { cookieStore.set({ name, value: '', ...options }); } catch {} },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// POST — promote a user exercise to system_exercises
// Body: { exercise_id, notification_id? }
export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { exercise_id, notification_id, difficulty } = await request.json();
  if (!exercise_id) {
    return NextResponse.json({ error: 'exercise_id is required' }, { status: 400 });
  }

  const db = getServiceDb();

  // Fetch the user's exercise (service role bypasses user_id RLS)
  const { data: ex, error: fetchError } = await db
    .from('exercises')
    .select('*, exercise_categories(name)')
    .eq('id', exercise_id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!ex) return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });

  // Check for existing system exercise with same name
  const { data: existing } = await db
    .from('system_exercises')
    .select('id, name')
    .ilike('name', ex.name)
    .maybeSingle();

  if (existing) {
    // Mark notification as promoted if provided
    if (notification_id) {
      await db.from('admin_notifications').update({ promoted: true, is_read: true }).eq('id', notification_id);
    }
    return NextResponse.json({ item: existing, already_exists: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catName: string = (ex as any).exercise_categories?.name || 'Other';

  const { data: created, error: insertError } = await db
    .from('system_exercises')
    .insert({
      name: ex.name,
      category: catName,
      instructions: ex.instructions || null,
      form_cues: ex.form_cues || null,
      primary_muscles: ex.primary_muscles || null,
      difficulty: difficulty || 'intermediate',
      equipment_needed: ex.equipment_needed || 'none',
      is_active: true,
    })
    .select('*')
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Mark notification as promoted
  if (notification_id) {
    await db.from('admin_notifications').update({ promoted: true, is_read: true }).eq('id', notification_id);
  }

  return NextResponse.json({ item: created, already_exists: false }, { status: 201 });
}
