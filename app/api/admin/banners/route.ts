// app/api/admin/banners/route.ts
// GET: list CentenarianOS banners | POST: create | PATCH: toggle/update | DELETE: deactivate
// Ported from contractor-os; app='centenarian' (shared marketing_banners table).

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getDb();
  const { data, error } = await db
    .from('marketing_banners')
    .select('*')
    .eq('app', 'centenarian')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { title, body: bannerBody, cta_text, cta_url, target_tiers, starts_at, ends_at } = body;

  if (!title || !bannerBody) {
    return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('marketing_banners')
    .insert({
      app: 'centenarian',
      title,
      body: bannerBody,
      cta_text: cta_text || 'Upgrade',
      cta_url: cta_url || '/pricing',
      target_tiers: Array.isArray(target_tiers) && target_tiers.length > 0 ? target_tiers : ['free'],
      starts_at: starts_at || null,
      ends_at: ends_at || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, is_active, ends_at } = await request.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (is_active !== undefined) updates.is_active = is_active;
  if (ends_at !== undefined) updates.ends_at = ends_at;

  const { data, error } = await db
    .from('marketing_banners')
    .update(updates)
    .eq('id', id)
    .eq('app', 'centenarian')
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const db = getDb();
  const { error } = await db
    .from('marketing_banners')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('app', 'centenarian');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
