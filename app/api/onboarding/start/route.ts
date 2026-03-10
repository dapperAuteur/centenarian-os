import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { module_slug } = await req.json();

  await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
      first_module_slug: module_slug || null,
    })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
