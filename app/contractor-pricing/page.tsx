import Link from 'next/link';
import { HardHat, Check, ArrowRight } from 'lucide-react';

const FEATURES = [
  'Unlimited jobs, time entries, and invoices',
  'Rate cards with quick-apply',
  'Earnings reports and 1099 tracking',
  'Job comparison tool',
  'Job board and replacement finding',
  'Venue knowledge base',
  'City guides with community sharing',
  'Union contract RAG chat (AI-powered)',
  'Union membership and dues tracking',
  'Pay stub scanning (Gemini Vision)',
  'Mileage and expense tracking',
  'Document storage and uploads',
  'CSV import and export',
  'Mobile-first dark theme',
];

export default function ContractorPricingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Nav */}
      <nav className="border-b border-neutral-800 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/contractor-landing" className="flex items-center gap-2">
            <HardHat size={24} className="text-amber-400" aria-hidden="true" />
            <span className="text-lg font-bold">JobHub</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">
              Log In
            </Link>
            <Link href="/signup" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-center text-3xl font-extrabold sm:text-4xl">Simple Pricing</h1>
        <p className="mt-3 text-center text-neutral-400">Everything included. No feature gating. No surprises.</p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {/* Monthly */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="text-lg font-semibold text-neutral-200">Monthly</h2>
            <div className="mt-3">
              <span className="text-4xl font-extrabold text-amber-400">$10</span>
              <span className="text-neutral-500">/month</span>
            </div>
            <p className="mt-2 text-sm text-neutral-500">Cancel anytime. No commitment.</p>
            <Link
              href="/signup"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 text-base font-medium text-white hover:bg-amber-500 min-h-11"
            >
              Get Started <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {/* Annual */}
          <div className="rounded-2xl border-2 border-amber-600 bg-neutral-900 p-6 relative">
            <span className="absolute -top-3 left-4 rounded-full bg-amber-600 px-3 py-0.5 text-xs font-bold text-white">
              Save $20
            </span>
            <h2 className="text-lg font-semibold text-neutral-200">Annual</h2>
            <div className="mt-3">
              <span className="text-4xl font-extrabold text-amber-400">$100</span>
              <span className="text-neutral-500">/year</span>
            </div>
            <p className="mt-2 text-sm text-neutral-500">$8.33/month, billed annually.</p>
            <Link
              href="/signup"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 text-base font-medium text-white hover:bg-amber-500 min-h-11"
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
                <Check size={16} className="mt-0.5 text-amber-400 shrink-0" aria-hidden="true" />
                <span className="text-sm text-neutral-300">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 space-y-4">
          <h2 className="text-xl font-bold text-center mb-6">FAQ</h2>
          {[
            { q: 'Is there a free plan?', a: 'No. We offer a focused paid product with no feature limits. Sign up and subscribe to get started.' },
            { q: 'Can I cancel anytime?', a: 'Yes. Monthly plans cancel immediately. Annual plans run through the billing period.' },
            { q: 'Do I need a CentenarianOS subscription?', a: 'No. Contractor Hub is a standalone product. You can subscribe to it independently.' },
            { q: 'What payment methods are accepted?', a: 'All major credit cards via Stripe. Secure checkout with no card data stored on our servers.' },
            { q: 'Is my data private?', a: 'Yes. Row-level security ensures your data is isolated. Shared features (job board, city guides, union docs) are opt-in only.' },
            { q: 'How do I get help if I have a problem?', a: 'Customer support is managed by a real human — not AI. Reach out through the in-app feedback form or email and a team member will respond personally.' },
          ].map((faq) => (
            <details key={faq.q} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 group">
              <summary className="cursor-pointer font-medium text-neutral-200 text-sm">{faq.q}</summary>
              <p className="mt-2 text-sm text-neutral-400">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-neutral-800 px-4 py-8 text-center text-xs text-neutral-500">
        <p>&copy; {new Date().getFullYear()} CentenarianOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
