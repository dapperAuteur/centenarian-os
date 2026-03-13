// app/institutions/[slug]/page.tsx
// Public institution detail page — full stats, offers, and policies.

import type { Metadata } from 'next';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import InstitutionDetail from './InstitutionDetail';
import PageViewTracker from '@/components/ui/PageViewTracker';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const { data: inst } = await db
    .from('institutions')
    .select('name, description, logo_url')
    .eq('slug', slug)
    .maybeSingle();
  if (!inst) return { title: 'Institution' };
  return {
    title: inst.name,
    description: inst.description || `${inst.name} on CentenarianOS`,
    openGraph: {
      title: inst.name,
      description: inst.description || `${inst.name} on CentenarianOS`,
      images: inst.logo_url
        ? [{ url: inst.logo_url }]
        : [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630 }],
      url: `${SITE_URL}/institutions/${slug}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: inst.name,
      images: inst.logo_url ? [inst.logo_url] : [`${SITE_URL}/og-default.png`],
    },
    alternates: { canonical: `${SITE_URL}/institutions/${slug}` },
  };
}

export default async function InstitutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <>
      <PageViewTracker path={`/institutions/${slug}`} />
      <InstitutionDetail />
    </>
  );
}
