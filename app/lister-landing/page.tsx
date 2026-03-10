import Link from 'next/link';
import {
  Users, Calendar, BarChart3, UserPlus, Shield, ClipboardList, MessageCircle,
  ArrowRight, Crown, Play,
} from 'lucide-react';

const FEATURES = [
  { slug: 'dashboard', icon: ClipboardList, title: 'Lister Dashboard', desc: 'Create and publish jobs for your crew. Track assignment status in real time.' },
  { slug: 'roster', icon: Users, title: 'Crew Roster', desc: 'Manage your pool of contractors with skills, unions, and availability notes.' },
  { slug: 'assign', icon: UserPlus, title: 'Assignment + Dispatch', desc: 'Assign contractors to jobs, track acceptance, reassign on the fly.' },
  { slug: 'messages', icon: MessageCircle, title: 'Crew Messaging', desc: 'Send individual or group messages to your roster. Read receipts included.' },
  { slug: 'availability', icon: Calendar, title: 'Availability Calendar', desc: 'See who\'s open on any given date. Cross-reference with job schedules.' },
  { slug: 'reports', icon: BarChart3, title: 'Reports', desc: 'Fill rates, response times, contractor performance. Data you can act on.' },
];

export default function ListerLandingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Nav */}
      <nav className="border-b border-neutral-800 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={24} className="text-indigo-400" aria-hidden="true" />
            <span className="text-lg font-bold">CrewOps</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/lister-pricing" className="text-sm text-neutral-400 hover:text-neutral-200 min-h-11 flex items-center">
              Pricing
            </Link>
            <Link href="/features/lister" className="text-sm text-neutral-400 hover:text-neutral-200 min-h-11 flex items-center">
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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 min-h-11 flex items-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          Staff Your Crews.
          <span className="block text-indigo-400">Dispatch with Confidence.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
          Create jobs, manage rosters, assign contractors, and communicate with your entire crew —
          built for coordinators, agencies, and union leaders.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white hover:bg-indigo-500 min-h-11"
          >
            Get Started <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href="/demo"
            className="flex items-center gap-2 rounded-lg border border-indigo-600/50 px-6 py-3 text-base text-indigo-400 hover:bg-indigo-600/10 min-h-11"
          >
            <Play size={16} aria-hidden="true" /> Try the Demo
          </Link>
          <Link
            href="/lister-pricing"
            className="flex items-center gap-2 rounded-lg border border-neutral-700 px-6 py-3 text-base text-neutral-300 hover:bg-neutral-800 min-h-11"
          >
            View Pricing
          </Link>
        </div>
      </section>

      {/* Features — each card links to detail page */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-label="Features">
        <h2 className="mb-4 text-center text-2xl font-bold sm:text-3xl">Everything You Need to Run Crews</h2>
        <p className="mb-10 text-center text-neutral-400 text-sm">Click any feature to learn more and try the demo</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.slug}
              href={`/features/lister/${f.slug}`}
              className="group rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-700 hover:bg-neutral-800/80 transition"
            >
              <f.icon size={20} className="text-indigo-400 mb-3" aria-hidden="true" />
              <h3 className="text-base font-semibold text-neutral-100 group-hover:text-white transition">{f.title}</h3>
              <p className="mt-1 text-sm text-neutral-400">{f.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-400 group-hover:text-indigo-300 transition">
                Learn more <ArrowRight size={12} aria-hidden="true" />
              </span>
            </Link>
          ))}
          {/* Non-linkable features */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <Crown size={20} className="text-indigo-400 mb-3" aria-hidden="true" />
            <h3 className="text-base font-semibold text-neutral-100">Union Leader Tools</h3>
            <p className="mt-1 text-sm text-neutral-400">Seniority tracking, rate enforcement, dispatch queues for union dispatchers.</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <Shield size={20} className="text-indigo-400 mb-3" aria-hidden="true" />
            <h3 className="text-base font-semibold text-neutral-100">Privacy + Control</h3>
            <p className="mt-1 text-sm text-neutral-400">Your roster, your data. Full control over who sees what.</p>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="border-t border-neutral-800 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl mb-3">Try Before You Buy</h2>
          <p className="text-neutral-400 mb-2">
            Explore CrewOps with a pre-loaded demo account. Real data, real features — no signup required.
          </p>
          <p className="text-sm text-neutral-500 mb-8">
            Shared account. Data resets daily. Do not enter personal information.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-indigo-500 transition min-h-11"
            >
              <Play size={18} aria-hidden="true" /> Launch Demo
            </Link>
            <Link
              href="/features/lister"
              className="flex items-center gap-2 rounded-xl border border-neutral-700 px-8 py-3.5 text-base text-neutral-300 hover:bg-neutral-800 transition min-h-11"
            >
              Explore All Features
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3 text-left">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <p className="text-sm font-medium text-indigo-400 mb-1">Pre-loaded Data</p>
              <p className="text-xs text-neutral-500">Jobs, rosters, assignments, messages, availability — ready to explore.</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <p className="text-sm font-medium text-indigo-400 mb-1">Interactive Tours</p>
              <p className="text-xs text-neutral-500">Guided walkthroughs for every module. Start from any feature page.</p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <p className="text-sm font-medium text-indigo-400 mb-1">Full Access</p>
              <p className="text-xs text-neutral-500">Every feature unlocked. Try roster management, dispatch, messaging, and more.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Academy Link */}
      <section className="border-t border-neutral-800 py-12 text-center">
        <p className="text-sm text-neutral-400">New to CrewOps?</p>
        <p className="mt-1 text-lg font-semibold text-neutral-200">Take the free Lister & Crew Coordinator Guide</p>
        <p className="mt-2 text-sm text-neutral-500">12 lessons covering everything from roster setup to union leader tools. No account required.</p>
        <Link href="/academy" className="mt-3 inline-block text-sm font-medium text-indigo-400 hover:text-indigo-300 min-h-11">
          Browse Academy courses &rarr;
        </Link>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-800 py-16 text-center">
        <h2 className="text-2xl font-bold">Ready to streamline crew management?</h2>
        <p className="mt-2 text-neutral-400">Intro pricing: $10/month (regularly $50). Limited time.</p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white hover:bg-indigo-500 min-h-11"
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
