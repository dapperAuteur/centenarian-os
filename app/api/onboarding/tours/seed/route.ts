import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // No tours to seed — contractor/lister tours have been removed
  return NextResponse.json({ ok: true, seeded: 0 });
}
