// app/api/auth/me/route.ts
// Returns whether the current user is admin or teacher.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ isAdmin: false, isTeacher: false, role: 'member' });

  const isAdmin = user.email === process.env.ADMIN_EMAIL;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = isAdmin ? 'admin' : (profile?.role ?? 'member');
  const isTeacher = role === 'teacher' || isAdmin;

  return NextResponse.json({ isAdmin, isTeacher, role });
}
