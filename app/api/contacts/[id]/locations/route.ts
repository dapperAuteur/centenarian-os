// app/api/contacts/[id]/locations/route.ts
// CRUD for contact locations (sub-locations under a contact).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

async function verifyOwnership(db: ReturnType<typeof getDb>, contactId: string, userId: string) {
  const { data } = await db
    .from('user_contacts')
    .select('id')
    .eq('id', contactId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: contactId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  if (!(await verifyOwnership(db, contactId, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await db
    .from('contact_locations')
    .select('*')
    .eq('contact_id', contactId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: contactId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  if (!(await verifyOwnership(db, contactId, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const { label, address, lat, lng, is_default, notes, sort_order } = body;

  if (!label?.trim()) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }

  // If setting as default, unset others first
  if (is_default) {
    await db
      .from('contact_locations')
      .update({ is_default: false })
      .eq('contact_id', contactId)
      .eq('is_default', true);
  }

  const { data, error } = await db
    .from('contact_locations')
    .insert({
      contact_id: contactId,
      label: label.trim(),
      address: address?.trim() || null,
      lat: lat ?? null,
      lng: lng ?? null,
      is_default: is_default ?? false,
      notes: notes?.trim() || null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: contactId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  if (!(await verifyOwnership(db, contactId, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const { location_id } = body;
  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  // Verify location belongs to this contact
  const { data: loc } = await db
    .from('contact_locations')
    .select('id')
    .eq('id', location_id)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (!loc) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

  const allowed = ['label', 'address', 'lat', 'lng', 'is_default', 'notes', 'sort_order'];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k)),
  );

  // If setting as default, unset others first
  if (updates.is_default === true) {
    await db
      .from('contact_locations')
      .update({ is_default: false })
      .eq('contact_id', contactId)
      .eq('is_default', true);
  }

  const { data, error } = await db
    .from('contact_locations')
    .update(updates)
    .eq('id', location_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: contactId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  if (!(await verifyOwnership(db, contactId, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const { location_id } = body;
  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const { error } = await db
    .from('contact_locations')
    .delete()
    .eq('id', location_id)
    .eq('contact_id', contactId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
