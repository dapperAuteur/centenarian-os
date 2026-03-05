'use client';

// components/finance/InstitutionDisclosure.tsx
// Transparency notice about anonymized institution data aggregation.

import { Info } from 'lucide-react';

interface InstitutionDisclosureProps {
  variant: 'banner' | 'inline';
}

export default function InstitutionDisclosure({ variant }: InstitutionDisclosureProps) {
  if (variant === 'inline') {
    return (
      <p className="text-xs text-gray-400 flex items-start gap-1.5 mt-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Your institution details (rates, fees, policies) are anonymized and aggregated to help educate the community about financial products. No personal information is ever shared.
      </p>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-500">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
        <p>
          Institution data is aggregated from anonymized user-reported information for educational purposes only.
          All personally identifiable information is removed. Most of this data — including APRs, fees, rewards rates,
          and dispute policies — is already publicly available from the institutions themselves.
          This is not financial advice.
        </p>
      </div>
    </div>
  );
}
