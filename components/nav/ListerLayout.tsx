'use client';

// components/nav/ListerLayout.tsx
// Dark-themed layout shell for the lister subdomain.

import ListerNav from './ListerNav';
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

export default function ListerLayout({ username, unreadMessages, onLogout, untoured, onToursChanged, children }: Props) {
  return (
    <div className="min-h-screen bg-neutral-950 dark-input">
      <ListerNav username={username} unreadMessages={unreadMessages} onLogout={onLogout} untoured={untoured} />
      <MfaBanner />
      <OfflineIndicator />
      <main id="main-content" className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 lg:pb-6">
        {children}
      </main>
      <TourRunner app="lister" onToursChanged={onToursChanged} />
    </div>
  );
}
