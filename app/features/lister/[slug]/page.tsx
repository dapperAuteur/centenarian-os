'use client';

import { useParams, notFound } from 'next/navigation';
import FeatureDetailPage from '@/components/features/FeatureDetailPage';
import {
  LISTER_FEATURES,
  getListerFeature,
} from '@/lib/features/lister-features';

export default function ListerFeatureSlugPage() {
  const { slug } = useParams<{ slug: string }>();
  const feature = getListerFeature(slug);

  if (!feature) return notFound();

  const related = LISTER_FEATURES.filter(
    (f) => f.group === feature.group && f.slug !== feature.slug,
  ).slice(0, 3);

  return (
    <FeatureDetailPage
      feature={feature}
      app="lister"
      appName="CrewOps"
      relatedFeatures={related}
    />
  );
}
