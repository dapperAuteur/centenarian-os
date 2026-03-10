import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [profileRes, toursRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('onboarding_completed, first_module_slug')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('module_tours')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ]);

  return NextResponse.json({
    onboarding_completed: profileRes.data?.onboarding_completed ?? false,
    first_module_slug: profileRes.data?.first_module_slug ?? null,
    tours: toursRes.data ?? [],
  });
}
