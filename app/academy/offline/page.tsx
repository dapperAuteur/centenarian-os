// app/academy/offline/page.tsx
// Standalone page that hosts the offline-storage manager for learners.
// Lives under /academy so it stays with the rest of the learner surface
// (dashboard is where the course-content-free management lives — this is
// specifically about Academy offline content).

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import OfflineStorageManager from '@/components/academy/offline/OfflineStorageManager';

export const metadata: Metadata = {
  title: 'Offline storage — Centenarian Academy',
  description: 'Manage the lessons you&rsquo;ve saved to watch without an internet connection.',
};

export default function OfflineStoragePage() {
  return (
    <div className="text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link
          href="/academy/my-courses"
          className="min-h-11 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to my courses
        </Link>
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Offline storage</h1>
          <p className="text-sm sm:text-base text-gray-400">
            Lessons you&rsquo;ve saved to this device. They play without an internet connection and count
            toward your browser&rsquo;s storage quota.
          </p>
        </header>
        <OfflineStorageManager />
      </div>
    </div>
  );
}
