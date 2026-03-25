'use client';

// app/pricing/page.tsx
// Public pricing page — no auth required

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Check, Shirt, Zap, ArrowLeft } from 'lucide-react';
import PurchaseModal from '@/components/PurchaseModal';
import SiteFooter from '@/components/ui/SiteFooter';
import PageViewTracker from '@/components/ui/PageViewTracker';

function FromSignupBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get('from') !== 'signup') return null;
  return (
    <div className="mb-8 max-w-xl mx-auto bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-800 rounded-xl px-5 py-4 text-center text-sm font-medium">
      Account created! Choose a plan below to access your dashboard.
    </div>
  );
}

const POLICIES = 'No Refunds. Cancel Anytime. Monthly fees are not transferable to lifetime membership.';

export default function PricingPage() {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'lifetime' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<'monthly' | 'lifetime' | null>(null);

  async function handleCheckout(plan: 'monthly' | 'lifetime') {
    setLoadingPlan(plan);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      if (res.status === 401) {
        // Show inline auth modal instead of redirecting away
        setPendingPlan(plan);
        setShowPurchaseModal(true);
        setLoadingPlan(null);
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Failed to start checkout');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoadingPlan(null);
    }
  }

  function handleAuthSuccess() {
    if (pendingPlan) {
      handleCheckout(pendingPlan);
      setPendingPlan(null);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <PageViewTracker path="/pricing" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">CentenarianOS</span>
          </Link>
          <div className="flex items-center space-x-4">
            {user ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors text-sm font-medium"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors text-sm font-medium"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Suspense fallback={null}>
          <FromSignupBanner />
        </Suspense>

        {/* Coaching CTA */}
        <Link
          href="/coaching"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-linear-to-br from-fuchsia-950 to-indigo-950 text-white rounded-2xl px-6 py-5 mb-12 hover:opacity-95 transition"
          aria-label="Learn about personal longevity coaching"
        >
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300 mb-1">Prefer a guide over a plan?</p>
            <p className="text-lg font-bold">Work with a coach, not just a platform.</p>
            <p className="text-sm text-fuchsia-200 mt-0.5">Personalized 1-on-1 longevity coaching for those who want expert support alongside the tools.</p>
          </div>
          <span className="shrink-0 px-5 py-2.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap">
            See Coaching Options
          </span>
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-gray-600">
            Choose a plan and unlock your full personal operating system.
          </p>
        </div>

        {error && (
          <div className="mb-8 max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Monthly Plan */}
          <div className="bg-white rounded-2xl border-2 border-fuchsia-400 p-8 flex flex-col relative shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-fuchsia-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Popular
              </span>
            </div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Monthly</h2>
              <p className="text-gray-500 text-sm">Full access, cancel anytime</p>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-gray-900">$10</span>
                <span className="text-gray-500 text-sm ml-1">/month</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Roadmap & goal hierarchy',
                'Daily task planner (week/3-day/daily views)',
                'Fuel & nutrition tracking (NCV framework)',
                'Focus Engine (timer, doodle canvas, debrief, pain log)',
                'Travel tracking with public transport, booking details & budgets',
                'Financial dashboard (accounts, budgets, invoices)',
                'Budget forecasting & bank linking via Teller',
                'Health metrics & wearable sync (Garmin, Oura, WHOOP)',
                'Workouts, exercises & Nomad Longevity OS protocol',
                'Equipment & asset tracking with valuations',
                'Smart scanner — AI-powered receipt & document OCR',
                'Life Categories — tag activities across all modules',
                'Life Retrospective with Google Calendar import',
                'Correlation analysis across health & lifestyle metrics',
                'Academy courses & 15+ tutorial guides',
                'Data Hub — bulk import/export for all modules',
                'Media tracker — books, TV, movies, podcasts & notes',
                'Cross-module linking, saved contacts & blog publishing',
                'Interactive feature walkthroughs & guided onboarding',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-fuchsia-500 mt-0.5 shrink-0" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout('monthly')}
              disabled={loadingPlan !== null}
              className="w-full px-4 py-3 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingPlan === 'monthly' ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {loadingPlan === 'monthly' ? 'Redirecting...' : 'Start Monthly'}
            </button>
          </div>

          {/* Lifetime Plan */}
          <div className="bg-linear-to-b from-gray-900 to-gray-800 rounded-2xl border-2 border-gray-700 p-8 flex flex-col text-white relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-lime-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Best Value
              </span>
            </div>
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-1">Lifetime</h2>
              <p className="text-gray-400 text-sm">Pay once, own it forever</p>
              <div className="mt-4">
                <span className="text-4xl font-extrabold">$100</span>
                <span className="text-gray-400 text-sm ml-1">one-time</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Everything in Monthly',
                'No recurring fees ever',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-lime-400 mt-0.5 shrink-0" aria-hidden="true" />
                  {f}
                </li>
              ))}
              <li className="flex items-start gap-2 text-sm text-lime-300 font-semibold">
                <Shirt className="w-4 h-4 text-lime-400 mt-0.5 shrink-0" aria-hidden="true" />
                Free CentenarianOS shirt from AwesomeWebStore.com
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('lifetime')}
              disabled={loadingPlan !== null}
              className="w-full px-4 py-3 bg-lime-500 text-gray-900 rounded-lg hover:bg-lime-400 transition-colors font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingPlan === 'lifetime' ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full" />
              ) : (
                <Shirt className="w-4 h-4" />
              )}
              {loadingPlan === 'lifetime' ? 'Redirecting...' : 'Get Lifetime Access'}
            </button>
          </div>
        </div>

        {/* Policies */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 font-medium">{POLICIES}</p>
        </div>

        {/* Try demo */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Want to try before you buy?{' '}
            <Link href="/demo" className="text-fuchsia-600 hover:underline font-medium">
              Explore the demo account
            </Link>
          </p>
        </div>

        {/* Feature comparison note */}
        <div className="mt-4 bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-600">
            Have questions?{' '}
            <a href="mailto:support@centenarianos.com" className="text-fuchsia-600 hover:underline font-medium">
              Contact support
            </a>
          </p>
        </div>
      </main>

      <SiteFooter theme="light" />

      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
