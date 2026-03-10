'use client';

// components/nav/ContractorLayout.tsx
// Dark-themed layout shell for the contractor subdomain.

import ContractorNav from './ContractorNav';
import OfflineIndicator from '@/components/ui/OfflineIndicator';
import MfaBanner from '@/components/ui/MfaBanner';
import TourRunner from '@/components/onboarding/TourRunner';

interface Props {
  username: string | null;
  unreadMessages: number;
  onLogout: () => void;
  untoured?: Set<string>;
  onToursChanged?: () => void;
  children: React.ReactNode;
}

export default function ContractorLayout({ username, unreadMessages, onLogout, untoured, onToursChanged, children }: Props) {
  return (
    <div className="min-h-screen bg-neutral-950 dark-input">
      <ContractorNav username={username} unreadMessages={unreadMessages} onLogout={onLogout} untoured={untoured} />
      <MfaBanner />
      <OfflineIndicator />
      <main id="main-content" className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 lg:pb-6">
        {children}
      </main>
      <TourRunner app="contractor" onToursChanged={onToursChanged} />
    </div>
  );
}
