// components/academy/AcademySubnav.tsx
// Slim nav shown on every academy page (rendered by app/academy/layout.tsx, so it appears on
// the catalog, explore, paths, course detail, lesson player, and teacher pages). Gives a
// consistent way back to the catalog and over to the teacher pages.

import Link from 'next/link';
import { GraduationCap, Users, BadgePlus } from 'lucide-react';

export default function AcademySubnav() {
  const link =
    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition min-h-11';
  return (
    <nav
      aria-label="Academy"
      className="border-b border-gray-800 bg-gray-950/80 backdrop-blur supports-[backdrop-filter]:bg-gray-950/60"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center gap-1 sm:gap-2 overflow-x-auto">
        <Link href="/academy" className={link} aria-label="Back to the Academy course catalog">
          <GraduationCap className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Academy</span>
        </Link>
        <Link href="/academy/teachers" className={link} aria-label="Browse all teachers">
          <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Browse teachers</span>
        </Link>
        <Link href="/academy/teach" className={link} aria-label="Become a teacher">
          <BadgePlus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Teach</span>
        </Link>
      </div>
    </nav>
  );
}
