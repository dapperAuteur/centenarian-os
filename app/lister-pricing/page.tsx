import Link from 'next/link';
import { Users, Check, ArrowRight } from 'lucide-react';

const FEATURES = [
  'Unlimited job listings',
  'Contractor roster management',
  'Job assignment and tracking',
  'Individual and group messaging',
  'Read receipts on messages',
  'Message group CRUD',
  'Availability calendar',
  'Fill rate and response reports',
  'Union leader tools (seniority, dispatch, rate enforcement)',
  'Invite contractors to the platform',
  'Cross-reference job schedules',
  'Mobile-first dark theme',
];

export default function ListerPricingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Nav */}
      <nav className="border-b border-neutral-800 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/lister-landing" className="flex items-center gap-2">
            <Users size={24} className="text-indigo-400" aria-hidden="true" />
            <span className="text-lg font-bold">CrewOps</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">
              Log In
            </Link>
            <Link href="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-center text-3xl font-extrabold sm:text-4xl">Lister Pricing</h1>
        <p className="mt-3 text-center text-neutral-400">Introductory pricing available for a limited time.</p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {/* Monthly */}
          <div className="rounded-2xl border-2 border-indigo-600 bg-neutral-900 p-6 relative">
            <span className="absolute -top-3 left-4 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-bold text-white">
              Intro Promo
            </span>
            <h2 className="text-lg font-semibold text-neutral-200">Monthly</h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-indigo-400">$10</span>
              <span className="text-neutral-500">/month</span>
            </div>
            <p className="mt-1 text-sm text-neutral-600 line-through">$50/month regular price</p>
            <p className="mt-1 text-sm text-neutral-500">Cancel anytime.</p>
            <Link
              href="/signup"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-base font-medium text-white hover:bg-indigo-500 min-h-11"
            >
              Get Started <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {/* Annual */}
          <div className="rounded-2xl border-2 border-indigo-600 bg-neutral-900 p-6 relative">
            <span className="absolute -top-3 left-4 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-bold text-white">
              Best Value
            </span>
            <h2 className="text-lg font-semibold text-neutral-200">Annual</h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-indigo-400">$100</span>
              <span className="text-neutral-500">/year</span>
            </div>
            <p className="mt-1 text-sm text-neutral-600 line-through">$500/year regular price</p>
            <p className="mt-1 text-sm text-neutral-500">$8.33/month, billed annually.</p>
            <Link
              href="/signup"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-base font-medium text-white hover:bg-indigo-500 min-h-11"
            >
              Get Started <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Feature list */}
        <div className="mt-16">
          <h2 className="text-xl font-bold text-center mb-6">Everything Included</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-2 py-1">
                <Check size={16} className="mt-0.5 text-indigo-400 shrink-0" aria-hidden="true" />
                <span className="text-sm text-neutral-300">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 space-y-4">
          <h2 className="text-xl font-bold text-center mb-6">FAQ</h2>
          {[
            { q: 'How long does the intro pricing last?', a: 'The promotional pricing will be available until we announce otherwise. Lock in now to keep your rate.' },
            { q: 'Do contractors need a subscription too?', a: 'Contractors you assign to jobs need their own Contractor Hub subscription ($10/mo) to accept assignments and log time.' },
            { q: 'Can I be both a lister and a contractor?', a: 'Yes. Subscribe to both products independently. Your dashboard adapts based on your role.' },
            { q: 'What union leader features are included?', a: 'Seniority tracking, minimum rate enforcement, dispatch queues, and union member directories. All included at the same price.' },
          ].map((faq) => (
            <details key={faq.q} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 group">
              <summary className="cursor-pointer font-medium text-neutral-200 text-sm">{faq.q}</summary>
              <p className="mt-2 text-sm text-neutral-400">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-neutral-800 px-4 py-8 text-center text-xs text-neutral-600">
        <p>&copy; {new Date().getFullYear()} CentenarianOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
