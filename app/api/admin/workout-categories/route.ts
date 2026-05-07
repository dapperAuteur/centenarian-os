// app/api/admin/workout-categories/route.ts
// Admin: manage global workout categories.
// GET: list all global categories with usage counts.
// POST: create a new global category.
// PATCH: update a global category.
// DELETE: delete a global category (only if unused).

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getServiceClient() {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();

  // Get all global categories with workout count
  const { data: categories, error } = await db
    .from('workout_categories')
    .select('*')
    .eq('is_global', true)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count workouts per category
  const counts = await Promise.all(
    (categories ?? []).map(async (cat) => {
      const { count } = await db
        .from('workout_templates')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', cat.id);
      return { ...cat, workout_count: count ?? 0 };
    }),
  );

  return NextResponse.json(counts);
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, icon, color, sort_order } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('workout_categories')
    .insert({
      user_id: null,
      name: name.trim(),
      icon: icon || null,
      color: color || null,
      sort_order: sort_order ?? 99,
      is_global: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, name, icon, color, sort_order } = await request.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const db = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name.trim();
  if (icon !== undefined) updates.icon = icon || null;
  if (color !== undefined) updates.color = color || null;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data, error } = await db
    .from('workout_categories')
    .update(updates)
    .eq('id', id)
    .eq('is_global', true)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const db = getServiceClient();

  // Check if any workouts use this category
  const { count } = await db
    .from('workout_templates')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: `Cannot delete — ${count} workout(s) use this category. Reassign them first.` }, { status: 400 });
  }

  const { error } = await db
    .from('workout_categories')
    .delete()
    .eq('id', id)
    .eq('is_global', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
