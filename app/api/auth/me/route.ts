// app/api/auth/me/route.ts
// Returns whether the current user is the admin (server-side check)

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ isAdmin: false });

  const isAdmin = user.email === process.env.ADMIN_EMAIL;
  return NextResponse.json({ isAdmin });
}
