// app/academy/teachers/[username]/layout.tsx
// Teacher page is 'use client' so metadata must come from this layout.

import type { Metadata } from 'next';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const db = getDb();
  const { data: profile } = await db
    .from('profiles')
    .select('display_name, username, bio')
    .eq('username', username)
    .maybeSingle();
  if (!profile) return { title: 'Instructor' };
  const name = profile.display_name || profile.username;
  return {
    title: `${name} · Instructor`,
    description: profile.bio || `Learn from ${name} on CentenarianOS Academy.`,
    openGraph: {
      title: `${name} · CentenarianOS Instructor`,
      description: profile.bio || `Learn from ${name} on CentenarianOS Academy.`,
      images: [`${SITE_URL}/api/og/profile/${username}`],
      url: `${SITE_URL}/academy/teachers/${username}`,
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} · CentenarianOS Instructor`,
      images: [`${SITE_URL}/api/og/profile/${username}`],
    },
    alternates: { canonical: `${SITE_URL}/academy/teachers/${username}` },
  };
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
