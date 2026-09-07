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
  { name: 'Wanderlust', href: 'https://wanderlust.witus.online' },
  { name: 'Fly.WitUS', href: 'https://fly.witus.online' },
  { name: 'FlashLearnAI', href: 'https://flashlearnai.witus.online' },
  { name: 'Learn.WitUS', href: 'https://learn.witus.online' },
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

  // Card tones: sky is CentOS's action colour, per the ecosystem footer recipe's instruction to
  // match the host app's palette rather than copying the reference implementation's.
  const cardCls = isDark
    ? 'mb-6 rounded-lg border border-sky-900 bg-sky-950/30 p-5'
    : 'mb-6 rounded-lg border border-sky-100 bg-sky-50/60 p-5';
  const eyebrowCls = isDark ? 'text-sky-400' : 'text-sky-700';
  const headingCls = isDark ? 'text-gray-100' : 'text-gray-900';
  const bodyCls = isDark ? 'text-gray-400' : 'text-gray-600';
  const actionCls = isDark
    ? 'text-sky-400 hover:text-sky-300 transition'
    : 'text-sky-700 hover:text-sky-600 transition';

  return (
    <footer className={containerCls}>
      {/*
        Rise Wellness callout — canonical across the WitUS ecosystem, per
        witus/public/brand/footer-recipe.md. It sits ABOVE the nav rather than inside the link
        row because mental-health resources warrant prominence.

        This is the SHORT form the recipe prescribes for CentenarianOS specifically: CentOS hosts
        the full Rise Wellness section itself at /safety#rise-wellness, so the footer points there
        instead of repeating the services list and address that sibling apps have to carry.

        The non-affiliation line is mandatory and stays verbatim — Rise Wellness is an independent
        provider, not part of WitUS.
      */}
      <section aria-labelledby="rise-wellness-heading" className={`max-w-5xl mx-auto ${cardCls}`}>
        <p className={`text-[11px] uppercase tracking-wide font-semibold ${eyebrowCls}`}>
          Mental health support
        </p>
        <h2 id="rise-wellness-heading" className={`text-base font-semibold ${headingCls}`}>
          Rise Wellness of Indiana
        </h2>
        <p className={`text-xs mt-0.5 ${bodyCls}`}>
          Independent mental health provider &middot; Not affiliated with CentenarianOS
        </p>
        <p className={`text-sm leading-relaxed mt-3 ${bodyCls}`}>
          Compassionate, personalized, holistic mental health care &mdash; evidence-based medicine,
          trauma-informed care, and a whole-person approach to help you heal, grow, and thrive in
          mind, body, and spirit.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link href="/safety#rise-wellness" className={`inline-flex items-center min-h-11 font-medium ${actionCls}`}>
            Services, hours &amp; location
          </Link>
          <a href="tel:+13179650299" className={`inline-flex items-center min-h-11 font-medium ${actionCls}`}>
            317-965-0299
          </a>
          <a
            href="https://risewellnessofindiana.com"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center min-h-11 font-medium ${actionCls}`}
          >
            risewellnessofindiana.com
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </section>

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
