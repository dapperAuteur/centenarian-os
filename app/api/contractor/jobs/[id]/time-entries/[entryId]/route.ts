// app/api/contractor/jobs/[id]/time-entries/[entryId]/route.ts
// PATCH: update a time entry
// DELETE: delete a time entry

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

const ALLOWED_FIELDS = [
  'work_date', 'time_in', 'time_out', 'adjusted_in', 'adjusted_out',
  'break_minutes', 'total_hours', 'st_hours', 'ot_hours', 'dt_hours',
  'meal_provided', 'notes',
];

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { entryId } = await ctx.params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('job_time_entries')
    .update(updates)
    .eq('id', entryId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { entryId } = await ctx.params;
  const db = getDb();

  const { error } = await db
    .from('job_time_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
