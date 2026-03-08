// app/api/contractor/cities/[id]/entries/[entryId]/route.ts
// PATCH: update a city guide entry
// DELETE: delete a city guide entry

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Ctx = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, entryId } = await ctx.params;
  const db = getDb();

  // Verify entry belongs to this guide and user owns it
  const { data: entry } = await db
    .from('city_guide_entries')
    .select('id, user_id, city_guide_id')
    .eq('id', entryId)
    .eq('city_guide_id', id)
    .maybeSingle();

  if (!entry || entry.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const allowed = ['category', 'name', 'address', 'lat', 'lng', 'rating', 'price_range', 'notes', 'url', 'near_venue_id', 'is_shared'];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k];
  }

  const { data, error } = await db
    .from('city_guide_entries')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, entryId } = await ctx.params;
  const db = getDb();

  const { error } = await db
    .from('city_guide_entries')
    .delete()
    .eq('id', entryId)
    .eq('city_guide_id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
