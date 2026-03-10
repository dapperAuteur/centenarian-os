'use client';

import { useParams, notFound } from 'next/navigation';
import FeatureDetailPage from '@/components/features/FeatureDetailPage';
import {
  CONTRACTOR_FEATURES,
  getContractorFeature,
} from '@/lib/features/contractor-features';

export default function ContractorFeatureSlugPage() {
  const { slug } = useParams<{ slug: string }>();
  const feature = getContractorFeature(slug);

  if (!feature) return notFound();

  // Related: other features in the same group, excluding current
  const related = CONTRACTOR_FEATURES.filter(
    (f) => f.group === feature.group && f.slug !== feature.slug,
  ).slice(0, 3);

  return (
    <FeatureDetailPage
      feature={feature}
      app="contractor"
      appName="JobHub"
      relatedFeatures={related}
    />
  );
}
