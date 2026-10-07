// app/api/engine/pain-entries/route.ts
// GET:  the signed-in person's pain entries, newest first, with filters and paging:
//       ?date=YYYY-MM-DD (one day) or ?from=&to=, ?min=&max= (intensity 0-10),
//       ?location= (a location, or "either:Hand" for both sides), ?q= (text in the notes),
//       ?offset=&limit= (default 50, at most 200). Answers { ready, notice?, entries,
//       days: { [date]: { daily_log_id, pain_intensity } }, has_more, next_offset }.
// POST: add an entry. Body: { id? (uuid from the browser, makes an offline replay safe),
//       occurred_at (ISO), local_date (YYYY-MM-DD, the person's own date for it), intensity
//       (0-10), locations[], sensations[], activities[], notes }. Every POST adds a new
//       entry; the day's daily_logs.pain_* summary is recomputed afterwards.
//
// Before migration 222 both fall back to the old one-per-day daily_logs record and answer
// ready: false with a "Run migration 222 first" notice. Rules: lib/pain/logic.ts.
// Reads and writes: lib/pain/server.ts.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseEntryInput } from '@/lib/pain/logic';
import { createEntry, listEntries } from '@/lib/pain/server';
import { errorResponse, readFilters } from '@/lib/pain/request';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await listEntries(supabase, user.id, readFilters(request.nextUrl.searchParams));
    return NextResponse.json({
      ready: result.ready,
      ...(result.ready ? {} : { notice: result.notice }),
      ...result.value,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
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
    const input = parseEntryInput(body, Date.now());
    const result = await createEntry(supabase, user.id, input, body.id);
    return NextResponse.json(
      {
        ready: result.ready,
        ...(result.ready ? {} : { notice: result.notice }),
        ...result.value,
      },
      { status: result.ready ? 201 : 200 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
