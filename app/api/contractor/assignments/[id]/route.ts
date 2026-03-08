// app/api/contractor/assignments/[id]/route.ts
// PATCH: accept/decline (worker) or remove (lister)
// DELETE: remove assignment (lister only)

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
  const db = getDb();

  const { data: assignment } = await db
    .from('contractor_job_assignments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isLister = assignment.assigned_by === user.id;
  const isWorker = assignment.assigned_to === user.id;

  if (!isLister && !isWorker) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { status, response_note } = await request.json();
  const updates: Record<string, unknown> = {};

  if (status === 'accepted' && isWorker && assignment.status === 'offered') {
    updates.status = 'accepted';
    updates.responded_at = new Date().toISOString();
    if (response_note) updates.response_note = response_note;
  } else if (status === 'declined' && isWorker && assignment.status === 'offered') {
    updates.status = 'declined';
    updates.responded_at = new Date().toISOString();
    if (response_note) updates.response_note = response_note;
  } else if (status === 'removed' && isLister) {
    updates.status = 'removed';
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data, error } = await db
    .from('contractor_job_assignments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const { error } = await db
    .from('contractor_job_assignments')
    .delete()
    .eq('id', id)
    .eq('assigned_by', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
