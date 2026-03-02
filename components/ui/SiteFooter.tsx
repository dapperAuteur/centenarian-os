// components/ui/SiteFooter.tsx
// Minimal footer for public pages. theme='dark' (default) or 'light'.

import Link from 'next/link';

interface SiteFooterProps {
  theme?: 'dark' | 'light';
}

export default function SiteFooter({ theme = 'dark' }: SiteFooterProps) {
  const year = new Date().getFullYear();

  const isDark = theme === 'dark';
  const containerCls = isDark
    ? 'border-t border-gray-800 bg-gray-950 py-8 px-6'
    : 'border-t border-gray-200 bg-white py-8 px-6';
  const linkCls = isDark
    ? 'text-gray-500 hover:text-gray-300 transition'
    : 'text-gray-400 hover:text-gray-700 transition';
  const copyCls = isDark ? 'text-xs text-gray-600' : 'text-xs text-gray-400';

  return (
    <footer className={containerCls}>
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="/terms" className={linkCls}>Terms of Use</Link>
          <Link href="/privacy" className={linkCls}>Privacy Policy</Link>
          <Link href="/safety" className={linkCls}>Safety &amp; Resources</Link>
          <Link href="/safety#rise-wellness" className={linkCls}>Rise Wellness</Link>
          <Link href="/blog" className={linkCls}>Blog</Link>
          <Link href="/recipes" className={linkCls}>Recipes</Link>
          <Link href="/academy" className={linkCls}>Academy</Link>
        </nav>
        <p className={`${copyCls} text-center sm:text-right shrink-0`}>
          &copy; {year} B4C LLC / AwesomeWebStore.com. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
