// app/api/contractor/roster/route.ts
// GET: list contractor contacts in roster (is_contractor = true)
// POST: add a contractor to roster
// DELETE: remove from roster (set is_contractor = false)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('user_contacts')
    .select('id, name, email, phone, skills, availability_notes, linked_user_id, use_count')
    .eq('user_id', user.id)
    .eq('is_contractor', true)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get usernames for linked users
  const linkedIds = (data ?? []).map((c) => c.linked_user_id).filter(Boolean);
  const usernameMap: Record<string, string> = {};
  if (linkedIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, username')
      .in('id', linkedIds);
    for (const p of profiles ?? []) usernameMap[p.id] = p.username ?? 'Anonymous';
  }

  const enriched = (data ?? []).map((c) => ({
    ...c,
    username: c.linked_user_id ? (usernameMap[c.linked_user_id] ?? null) : null,
  }));

  return NextResponse.json({ roster: enriched });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await request.json();
  const { name, email, phone, skills, availability_notes, linked_user_id } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  // Upsert: if contact with this name exists, update it
  const { data: existing } = await db
    .from('user_contacts')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', name.trim())
    .maybeSingle();

  if (existing) {
    const { data, error } = await db
      .from('user_contacts')
      .update({
        is_contractor: true,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        skills: skills ?? null,
        availability_notes: availability_notes?.trim() || null,
        linked_user_id: linked_user_id || null,
      })
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
      contact_type: 'vendor',
      is_contractor: true,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      skills: skills ?? null,
      availability_notes: availability_notes?.trim() || null,
      linked_user_id: linked_user_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { contact_id } = await request.json();
  if (!contact_id) return NextResponse.json({ error: 'contact_id required' }, { status: 400 });

  const db = getDb();
  const { error } = await db
    .from('user_contacts')
    .update({ is_contractor: false })
    .eq('id', contact_id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ removed: true });
}
