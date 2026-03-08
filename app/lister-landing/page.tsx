import Link from 'next/link';
import {
  Users, Send, Calendar, BarChart3, UserPlus, Shield, ClipboardList, MessageCircle,
  ArrowRight, Crown,
} from 'lucide-react';

const FEATURES = [
  { icon: ClipboardList, title: 'Job Listing', desc: 'Create and publish jobs for your crew. Track assignment status in real time.' },
  { icon: Users, title: 'Crew Roster', desc: 'Manage your pool of contractors with skills, unions, and availability notes.' },
  { icon: UserPlus, title: 'Assignment + Dispatch', desc: 'Assign contractors to jobs, track acceptance, reassign on the fly.' },
  { icon: MessageCircle, title: 'Group Messaging', desc: 'Send individual or group messages to your roster. Read receipts included.' },
  { icon: Calendar, title: 'Availability Calendar', desc: 'See who\'s open on any given date. Cross-reference with job schedules.' },
  { icon: BarChart3, title: 'Reports', desc: 'Fill rates, response times, contractor performance. Data you can act on.' },
  { icon: Crown, title: 'Union Leader Tools', desc: 'Seniority tracking, rate enforcement, dispatch queues for union dispatchers.' },
  { icon: Shield, title: 'Privacy + Control', desc: 'Your roster, your data. Full control over who sees what.' },
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
            <Link href="/lister-pricing" className="text-sm text-neutral-400 hover:text-neutral-200">
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Start Free Trial
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
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white hover:bg-indigo-500"
          >
            Start Free Trial <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href="/lister-pricing"
            className="flex items-center gap-2 rounded-lg border border-neutral-700 px-6 py-3 text-base text-neutral-300 hover:bg-neutral-800"
          >
            View Pricing
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-label="Features">
        <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">Everything You Need to Run Crews</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
              <f.icon size={20} className="text-indigo-400 mb-3" aria-hidden="true" />
              <h3 className="text-base font-semibold text-neutral-100">{f.title}</h3>
              <p className="mt-1 text-sm text-neutral-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-800 py-16 text-center">
        <h2 className="text-2xl font-bold">Ready to streamline crew management?</h2>
        <p className="mt-2 text-neutral-400">Intro pricing: $10/month (regularly $50). Limited time.</p>
        <div className="mt-6">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white hover:bg-indigo-500"
          >
            Start Free Trial <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-neutral-800 px-4 py-8 text-center text-xs text-neutral-600">
        <p>&copy; {new Date().getFullYear()} CentenarianOS. All rights reserved.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="/terms" className="hover:text-neutral-400">Terms</Link>
          <Link href="/privacy" className="hover:text-neutral-400">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
