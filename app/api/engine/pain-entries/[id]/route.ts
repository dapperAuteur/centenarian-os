// app/api/engine/pain-entries/[id]/route.ts
// PATCH:  change an entry. Body: any of occurred_at (+ local_date), intensity, locations,
//         sensations, activities, notes. Recomputes the day's daily_logs.pain_* summary, and
//         the previous day's too when the new time moves the entry to another date.
//         Answers { entry, days }.
// DELETE: delete an entry and recompute its day. Answers { day }.
//
// Another person's entry and a missing one both answer 404. Before migration 222 the ids
// are "day-<daily_logs id>" (lib/pain/server.ts) and these edit or clear that day's record.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseEntryPatch } from '@/lib/pain/logic';
import { deleteEntry, updateEntry } from '@/lib/pain/server';
import { errorResponse } from '@/lib/pain/request';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
  }

  try {
    const result = await updateEntry(supabase, user.id, id, parseEntryPatch(body, Date.now()));
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await deleteEntry(supabase, user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
