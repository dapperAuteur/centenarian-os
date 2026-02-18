// app/blog/layout.tsx
// Public blog layout — light-themed, no auth required, matches site style.

import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo + breadcrumb */}
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/"
                className="text-base sm:text-lg font-bold text-gray-900 hover:text-sky-700 transition"
              >
                CentenarianOS
              </Link>
              <span className="text-gray-300 hidden sm:inline">/</span>
              <Link
                href="/blog"
                className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                <BookOpen className="w-4 h-4" />
                Blog
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-2 sm:gap-4 text-sm">
              <Link
                href="/blog"
                className="text-gray-600 hover:text-gray-900 transition px-2 py-1 rounded-lg hover:bg-gray-100"
              >
                All Posts
              </Link>
              <Link
                href="/blog/authors"
                className="text-gray-600 hover:text-gray-900 transition px-2 py-1 rounded-lg hover:bg-gray-100"
              >
                Authors
              </Link>
              <Link
                href="/dashboard/blog"
                className="px-3 py-1.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition"
              >
                Write
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <div className="bg-gray-50 text-gray-900">
        {children}
      </div>
    </div>
  );
}
