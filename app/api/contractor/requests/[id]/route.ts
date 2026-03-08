// app/api/contractor/requests/[id]/route.ts
// PATCH: accept/decline/withdraw a replacement request
// DELETE: delete a request (poster or requester)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const { status, poster_note } = await request.json();

  const db = getDb();

  // Get the request first
  const { data: req } = await db
    .from('job_replacement_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  // Poster can accept/decline; requester can withdraw
  const isPoster = req.poster_id === user.id;
  const isRequester = req.requester_id === user.id;

  if (!isPoster && !isRequester) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (status === 'accepted' && isPoster) {
    updates.status = 'accepted';
    if (poster_note) updates.poster_note = poster_note;

    // When accepted, share contacts if share_contacts is enabled
    // The board/detail pages will handle showing contact info based on this

  } else if (status === 'declined' && isPoster) {
    updates.status = 'declined';
    if (poster_note) updates.poster_note = poster_note;
  } else if (status === 'withdrawn' && isRequester) {
    updates.status = 'withdrawn';
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data, error } = await db
    .from('job_replacement_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const { error } = await db
    .from('job_replacement_requests')
    .delete()
    .eq('id', id)
    .or(`poster_id.eq.${user.id},requester_id.eq.${user.id}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
