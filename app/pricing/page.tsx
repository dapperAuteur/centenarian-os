'use client';

// app/pricing/page.tsx
// Public pricing page — no auth required

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Check, Shirt, Zap, ArrowLeft, DollarSign, CheckCircle } from 'lucide-react';
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
  const [foundersRemaining, setFoundersRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/pricing/founders')
      .then((r) => r.json())
      .then((d) => { if (d.active) setFoundersRemaining(d.remaining); })
      .catch(() => {});
  }, []);

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

  async function handleCashAppSubmit() {
    if (!user) {
      setPendingPlan('lifetime');
      setShowPurchaseModal(true);
      return;
    }
    setCashAppSubmitting(true);
    setCashAppError(null);
    try {
      const res = await fetch('/api/cashapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashapp_name: cashAppName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Submission failed');
      setCashAppSubmitted(true);
    } catch (err) {
      setCashAppError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCashAppSubmitting(false);
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
                <span className="text-4xl font-extrabold text-gray-900">$10.60</span>
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
                <span className="text-4xl font-extrabold">$103.29</span>
                <span className="text-gray-400 text-sm ml-1">one-time</span>
              </div>
              {foundersRemaining !== null && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-lime-400 uppercase tracking-wider mb-1.5">
                    Founder&apos;s Price — {foundersRemaining} of 100 remaining
                  </p>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lime-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(2, ((100 - foundersRemaining) / 100) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
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

        {/* CashApp Option — Lifetime only */}
        <div className="mt-12 max-w-3xl mx-auto">
          <button
            onClick={() => setShowCashApp(!showCashApp)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl hover:bg-emerald-100 transition text-sm font-semibold"
          >
            <DollarSign className="w-4 h-4" />
            Pay with CashApp — $100 Lifetime (no processing fees)
          </button>

          {showCashApp && (
            <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              {cashAppSubmitted ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-900 mb-1">Payment Submitted!</h3>
                  <p className="text-sm text-gray-600">
                    We&apos;ll verify your CashApp payment and activate your lifetime membership shortly.
                    Check your billing page for status updates.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="shrink-0">
                      <Image
                        src="/images/cashapp-qr.jpg"
                        alt="CashApp QR code for $centenarian"
                        width={160}
                        height={160}
                        className="rounded-xl border border-gray-200"
                      />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="font-bold text-gray-900 mb-2">Send $100 via CashApp</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Scan the QR code or send <span className="font-bold text-emerald-700">$100</span> to{' '}
                        <span className="font-mono font-bold text-emerald-700">$centenarian</span>
                      </p>
                      <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
                        <li>Send $100 to <span className="font-mono font-semibold">$centenarian</span> on CashApp</li>
                        <li>Enter your CashApp display name below</li>
                        <li>Click &quot;I&apos;ve Paid&quot; — we&apos;ll verify and activate your account</li>
                      </ol>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={cashAppName}
                      onChange={(e) => setCashAppName(e.target.value)}
                      placeholder="Your CashApp display name"
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleCashAppSubmit}
                      disabled={cashAppSubmitting}
                      className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 min-h-11"
                    >
                      {cashAppSubmitting ? (
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      {cashAppSubmitting ? 'Submitting...' : "I've Paid"}
                    </button>
                  </div>

                  {cashAppError && (
                    <p className="mt-3 text-sm text-red-600 text-center">{cashAppError}</p>
                  )}
                </>
              )}
            </div>
          )}
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

        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto space-y-6">
            {[
              { q: 'Can I try CentenarianOS before subscribing?', a: 'Yes! We offer a full-featured demo account you can explore without creating an account or entering payment info.' },
              { q: 'What\'s the difference between Monthly and Lifetime?', a: 'Both plans give you full access to every module. Monthly is $10.60/month and can be canceled anytime. Lifetime is a one-time $103.29 payment that includes a free CentenarianOS shirt.' },
              { q: 'Can I switch from Monthly to Lifetime?', a: 'Yes. When you purchase Lifetime, your monthly subscription is automatically canceled. Note that monthly fees already paid are not credited toward the lifetime price.' },
              { q: 'Is my data private?', a: 'Absolutely. Your data is encrypted at rest and in transit. We never share or sell your data to third parties. Row-level security ensures only you can access your information.' },
              { q: 'What devices does CentenarianOS work on?', a: 'CentenarianOS is a progressive web app (PWA) that works on any modern browser — desktop, tablet, or phone. Install it to your home screen for a native app experience.' },
              { q: 'Do you offer refunds?', a: 'We do not offer refunds on subscriptions. You can cancel your monthly plan at any time and retain access until the end of your billing period.' },
            ].map(({ q, a }) => (
              <div key={q} className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-2">{q}</h3>
                <p className="text-sm text-gray-600">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="mt-8 bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-600">
            Have more questions?{' '}
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
