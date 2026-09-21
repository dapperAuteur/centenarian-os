import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mediaRetiredResponse } from '@/lib/media/retired';

// Media is read-only now that it moved to Stream.WitUS, so this GET only reads.
// It used to seed six default categories on first access; that insert is gone, and a
// user with no categories now gets an empty list.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('media_categories')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ categories: data || [] });
}

// Media moved to Stream.WitUS: writes are retired (410 Gone). See lib/media/retired.ts.
export function POST() {
  return mediaRetiredResponse();
}
