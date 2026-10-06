// app/api/meals/route.ts
// POST: log a meal. Body: { date: 'YYYY-MM-DD', time: 'HH:MM', meal_type?, notes?, protocol_id?,
//       is_restaurant_meal?, restaurant_name?, restaurant_address?, restaurant_city?,
//       restaurant_state?, restaurant_country?, restaurant_website? } -> 201 { meal }
//
// Cookie auth first, then the service-role client. The rules (meal type, a protocol must be the
// caller's own, a restaurant meal has no protocol) live in lib/capture/create-record.ts,
// shared with the Google Calendar sync. Reading and deleting meals still happen in the browser
// under RLS (app/dashboard/fuel/meals).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMealLog } from '@/lib/capture/create-record';
import { getServiceDb } from '@/lib/finance/transfers/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON object.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Send a JSON object.' }, { status: 400 });
  }

  const result = await createMealLog(getServiceDb(), user.id, body as Record<string, unknown>);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ meal: result.value }, { status: 201 });
}
