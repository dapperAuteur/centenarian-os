import Link from 'next/link';
import {
  HardHat, FileText, CreditCard, BarChart3, Users, Building2,
  MapPin, Scale, Car, DollarSign, ScanLine, Shield, ArrowRight, Play,
} from 'lucide-react';

const FEATURES = [
  { slug: 'jobs', icon: HardHat, title: 'Job Management', desc: 'Track assignments, time entries with ST/OT/DT splits, and generate invoices automatically.' },
  { slug: 'rate-cards', icon: CreditCard, title: 'Rate Cards', desc: 'Save rate presets by union and department. Quick-apply to new jobs.' },
  { slug: 'reports', icon: BarChart3, title: 'Financial Reports', desc: 'Earnings by client, 1099 tracking, job comparison, and tax-ready exports.' },
  { slug: 'board', icon: Users, title: 'Job Board', desc: 'Find replacement work or share jobs with trusted colleagues.' },
  { slug: 'venues', icon: Building2, title: 'Venue Knowledge Base', desc: 'Parking, WiFi, load-in details, schematics for every venue you work.' },
  { slug: 'cities', icon: MapPin, title: 'City Guides', desc: 'Community restaurant, hotel, gym, and coffee recommendations by city.' },
  { slug: 'union', icon: Scale, title: 'Union Contract Chat', desc: 'Upload contracts, ask questions with AI. RAG-powered with mandatory disclaimers.' },
  { slug: 'travel', icon: Car, title: 'Mileage + Expenses', desc: 'Automatic distance calculation, trip logging, fuel tracking, expense reports.' },
  { slug: 'invoices', icon: FileText, title: 'Invoice Generation', desc: 'Auto-generate invoices from time entries with rate-based line items and benefits.' },
  { slug: 'finance', icon: DollarSign, title: 'Dues Tracking', desc: 'Track union memberships across multiple locals. Dues scheduling and payment history.' },
  { slug: 'scan', icon: ScanLine, title: 'Pay Stub Scan', desc: 'Upload a photo of your pay stub. AI extracts hours, rates, and benefits.' },
];

export default function ContractorLandingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Nav */}
      <nav className="border-b border-neutral-800 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <HardHat size={24} className="text-amber-400" aria-hidden="true" />
            <span className="text-lg font-bold">JobHub</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/contractor-pricing" className="text-sm text-neutral-400 hover:text-neutral-200 min-h-11 flex items-center">
              Pricing
            </Link>
            <Link href="/features/contractor" className="text-sm text-neutral-400 hover:text-neutral-200 min-h-11 flex items-center">
              Features
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 min-h-11 flex items-center"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 min-h-11 flex items-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          Your Job Hub.
          <span className="block text-amber-400">One Place for Everything.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
          Jobs, invoices, mileage, expenses, union contracts, venue knowledge — all in one
          tool built for independent broadcast and production contractors.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-6 py-3 text-base font-medium text-white hover:bg-amber-500 min-h-11"
          >
            Get Started <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href="/demo"
            className="flex items-center gap-2 rounded-lg border border-amber-600/50 px-6 py-3 text-base text-amber-400 hover:bg-amber-600/10 min-h-11"
          >
            <Play size={16} aria-hidden="true" /> Try the Demo
          </Link>
          <Link
            href="/contractor-pricing"
            className="flex items-center gap-2 rounded-lg border border-neutral-700 px-6 py-3 text-base text-neutral-300 hover:bg-neutral-800 min-h-11"
          >
            View Pricing
          </Link>
        </div>
      </section>

      {/* Features — each card links to detail page */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-label="Features">
        <h2 className="mb-4 text-center text-2xl font-bold sm:text-3xl">Built for Contractors</h2>
        <p className="mb-10 text-center text-neutral-400 text-sm">Click any feature to learn more and try the demo</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.slug}
              href={`/features/contractor/${f.slug}`}
              className="group rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-700 hover:bg-neutral-800/80 transition"
            >
              <f.icon size={20} className="text-amber-400 mb-3" aria-hidden="true" />
              <h3 className="text-base font-semibold text-neutral-100 group-hover:text-white transition">{f.title}</h3>
              <p className="mt-1 text-sm text-neutral-400">{f.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-400 group-hover:text-amber-300 transition">
                Learn more <ArrowRight size={12} aria-hidden="true" />
              </span>
            </Link>
          ))}
          {/* Privacy — no detail page */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <Shield size={20} className="text-amber-400 mb-3" aria-hidden="true" />
            <h3 className="text-base font-semibold text-neutral-100">Privacy First</h3>
            <p className="mt-1 text-sm text-neutral-400">Your data stays yours. RLS-protected, no data sharing without your consent.</p>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="border-t border-neutral-800 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl mb-3">Try Before You Buy</h2>
          <p className="text-neutral-400 mb-2">
            Explore JobHub with a pre-loaded demo account. Real data, real features — no signup required.
          </p>
          <p className="text-sm text-neutral-500 mb-8">
            Shared account. Data resets daily. Do not enter personal information.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="flex items-center gap-2 rounded-xl bg-amber-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-amber-500 transition min-h-11"
            >
              <Play size={18} aria-hidden="true" /> Launch Demo
            </Link>
            <Link
              href="/features/contractor"
              className="flex items-center gap-2 rounded-xl border border-neutral-700 px-8 py-3.5 text-base text-neutral-300 hover:bg-neutral-800 transition min-h-11"
            >
              Explore All Features
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3 text-left">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <p className="text-sm font-medium text-amber-400 mb-1">Pre-loaded Data</p>
              <p className="text-xs text-neutral-500">Jobs, invoices, rate cards, contacts, financial transactions, and more.</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <p className="text-sm font-medium text-amber-400 mb-1">Interactive Tours</p>
              <p className="text-xs text-neutral-500">Guided walkthroughs for every module. Start from any feature page.</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <p className="text-sm font-medium text-amber-400 mb-1">Full Access</p>
              <p className="text-xs text-neutral-500">Every feature unlocked. Try jobs, venues, cities, invoicing, travel, and more.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Academy Link */}
      <section className="border-t border-neutral-800 py-12 text-center">
        <p className="text-sm text-neutral-400">New to JobHub?</p>
        <p className="mt-1 text-lg font-semibold text-neutral-200">Take the free Contractor Job Hub Guide</p>
        <p className="mt-2 text-sm text-neutral-500">15 lessons covering everything from job creation to 1099 tracking. No account required.</p>
        <Link href="/academy" className="mt-3 inline-block text-sm font-medium text-amber-400 hover:text-amber-300 min-h-11">
          Browse Academy courses &rarr;
        </Link>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-800 py-16 text-center">
        <h2 className="text-2xl font-bold">Ready to get organized?</h2>
        <p className="mt-2 text-neutral-400">$10/month or $100/year. No free tier — just the tools you need.</p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-6 py-3 text-base font-medium text-white hover:bg-amber-500 min-h-11"
          >
            Get Started <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-6 py-3 text-sm text-neutral-300 hover:border-neutral-500 min-h-11"
          >
            Already have an account? Log in
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800 px-4 py-8 text-center text-xs text-neutral-500">
        <p>&copy; {new Date().getFullYear()} CentenarianOS. All rights reserved.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="/terms" className="hover:text-neutral-400">Terms</Link>
          <Link href="/privacy" className="hover:text-neutral-400">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
