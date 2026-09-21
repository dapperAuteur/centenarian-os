// app/api/media/creators/route.ts
// GET: list saved creators sorted by use_count DESC
// POST: retired (410 Gone), Media moved to Stream.WitUS

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mediaRetiredResponse } from '@/lib/media/retired';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('media_creators')
    .select('id, name, use_count')
    .eq('user_id', user.id)
    .order('use_count', { ascending: false })
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// Media moved to Stream.WitUS: writes are retired (410 Gone). See lib/media/retired.ts.
export function POST() {
  return mediaRetiredResponse();
}
