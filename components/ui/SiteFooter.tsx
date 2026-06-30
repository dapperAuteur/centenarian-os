// components/ui/SiteFooter.tsx
// Minimal footer for public pages. theme='dark' (default) or 'light'.

import Link from 'next/link';

interface SiteFooterProps {
  theme?: 'dark' | 'light';
}

// Canonical WitUS sibling list — mirror of gemini/witus/lib/products.ts. CentenarianOS
// omits itself; ride/stories are intentionally absent from every app's footer.
const SIBLING_PRODUCTS: { name: string; href: string }[] = [
  { name: 'WitUS.online', href: 'https://witus.online' },
  { name: 'Work.WitUS', href: 'https://work.witus.online' },
  { name: 'Tour Manager OS', href: 'https://tour.witus.online' },
  { name: 'Wanderlearn', href: 'https://wanderlearn.witus.online' },
  { name: 'Fly.WitUS', href: 'https://fly.witus.online' },
  { name: 'FlashLearnAI', href: 'https://flashlearnai.witus.online' },
  { name: 'Learn.WitUS', href: 'https://centenarianos.com/academy' },
  { name: 'Stream.WitUS', href: 'https://stream.witus.online' },
  { name: 'Centenarian Coach', href: 'https://centenarian.coach.multiagent.witus.online' },
  { name: 'Shop.WitUS', href: 'https://shop.witus.online' },
  { name: 'AwesomeWebStore', href: 'https://awesomewebstore.com' },
  { name: 'WitUS Inbox', href: 'https://inbox.witus.online' },
  { name: 'WitUS Outbox', href: 'https://outbox.witus.online' },
  { name: 'Triage.Agent.WitUS', href: 'https://triage.agent.witus.online' },
  { name: 'Wanderlearn Field Reporter', href: 'https://wanderlearn.field.reporter.witus.online' },
];

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

  const dividerCls = isDark ? 'border-gray-800' : 'border-gray-200';

  return (
    <footer className={containerCls}>
      <div className="max-w-5xl mx-auto mb-6">
        <p className={`text-xs uppercase tracking-widest mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Part of the WitUS ecosystem
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SIBLING_PRODUCTS.map((p) => (
            <li key={p.href}>
              <a href={p.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
                {p.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className={`max-w-5xl mx-auto border-t ${dividerCls} pt-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
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
          &copy; {year} CentenarianOS. Powered by{' '}
          <a
            href="https://witus.online"
            target="_blank"
            rel="noopener noreferrer"
            className={isDark ? 'text-sky-500 hover:text-sky-400 transition' : 'text-sky-600 hover:text-sky-500 transition'}
          >
            WitUS.online
          </a>
          , a B4C LLC / AwesomeWebStore.com brand.
        </p>
      </div>
    </footer>
  );
}
