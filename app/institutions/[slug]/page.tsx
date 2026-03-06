// app/institutions/[slug]/page.tsx
// Public institution detail page — full stats, offers, and policies.

import InstitutionDetail from './InstitutionDetail';
import PageViewTracker from '@/components/ui/PageViewTracker';

export default async function InstitutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <>
      <PageViewTracker path={`/institutions/${slug}`} />
      <InstitutionDetail />
    </>
  );
}
