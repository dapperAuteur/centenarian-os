// app/dashboard/page.tsx
// Redirects to the user's chosen dashboard home page.
// Falls back to /dashboard/blog (free-tier accessible) if no preference is set.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('dashboard_home')
    .eq('id', user.id)
    .single();

  redirect(profile?.dashboard_home ?? '/dashboard/blog');
}
