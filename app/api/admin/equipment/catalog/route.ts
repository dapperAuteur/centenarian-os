// app/api/admin/equipment/catalog/route.ts
// Admin-only: GET all catalog items + POST new items

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

export async function GET() {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('equipment_catalog')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ catalog: data || [] });
}

export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, brand, model, category, description, image_url, equipment_id, notification_id } = body;

  const db = getServiceClient();

  // If equipment_id is provided, promote that user equipment item to catalog
  if (equipment_id) {
    const { data: eq, error: fetchErr } = await db
      .from('equipment')
      .select('*, equipment_categories(name)')
      .eq('id', equipment_id)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!eq) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });

    // Check for duplicate by name
    const { data: existing } = await db
      .from('equipment_catalog')
      .select('id, name')
      .ilike('name', eq.name)
      .maybeSingle();

    if (existing) {
      if (notification_id) {
        await db.from('admin_notifications').update({ promoted: true, is_read: true }).eq('id', notification_id);
      }
      return NextResponse.json({ item: existing, already_exists: true });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catName: string | null = (eq as any).equipment_categories?.name ?? null;

    const { data: created, error: insertErr } = await db
      .from('equipment_catalog')
      .insert({
        name: eq.name,
        brand: eq.brand || null,
        model: eq.model || null,
        category: catName || null,
        is_active: true,
      })
      .select('*')
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    if (notification_id) {
      await db.from('admin_notifications').update({ promoted: true, is_read: true }).eq('id', notification_id);
    }
    return NextResponse.json({ item: created, already_exists: false }, { status: 201 });
  }

  // Manual create from body
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data, error } = await db
    .from('equipment_catalog')
    .insert({
      name: name.trim(),
      brand: brand?.trim() || null,
      model: model?.trim() || null,
      category: category?.trim() || null,
      description: description?.trim() || null,
      image_url: image_url?.trim() || null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
