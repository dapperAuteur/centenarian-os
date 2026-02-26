// app/api/contacts/route.ts
// GET: list saved contacts filtered by type (vendor | customer | location)
// POST: create or upsert a contact (increments use_count on duplicate)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = request.nextUrl.searchParams.get('type');

  const db = getDb();
  let query = db
    .from('user_contacts')
    .select('id, name, contact_type, default_category_id, notes, use_count')
    .eq('user_id', user.id)
    .order('use_count', { ascending: false })
    .order('name', { ascending: true });

  if (type) query = query.eq('contact_type', type);

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, contact_type, default_category_id, notes } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!['vendor', 'customer', 'location'].includes(contact_type)) {
    return NextResponse.json({ error: 'Invalid contact_type' }, { status: 400 });
  }

  const db = getDb();

  // Check if contact already exists — if so, increment use_count
  const { data: existing } = await db
    .from('user_contacts')
    .select('id, use_count')
    .eq('user_id', user.id)
    .eq('name', name.trim())
    .eq('contact_type', contact_type)
    .maybeSingle();

  if (existing) {
    const { data, error } = await db
      .from('user_contacts')
      .update({ use_count: existing.use_count + 1 })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await db
    .from('user_contacts')
    .insert({
      user_id: user.id,
      name: name.trim(),
      contact_type,
      default_category_id: default_category_id ?? null,
      notes: notes?.trim() ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
