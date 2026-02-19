'use client';

// app/pricing/page.tsx
// Public pricing page — no auth required

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Shirt, Zap, ArrowLeft } from 'lucide-react';

const POLICIES = 'No Refunds. Cancel Anytime. Monthly fees are not transferable to lifetime membership.';

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'lifetime' | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        router.push('/login?redirect=/pricing');
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">CentenarianOS</span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors text-sm font-medium"
            >
              Sign up free
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-gray-600">
            Start free. Upgrade when you&apos;re ready to unlock your full operating system.
          </p>
        </div>

        {error && (
          <div className="mb-8 max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 flex flex-col">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Free</h2>
              <p className="text-gray-500 text-sm">Forever free</p>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-gray-900">$0</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Blog — read & write posts',
                'Recipes — browse & save recipes',
                'Public profile',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="w-full text-center px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-semibold text-sm"
            >
              Get started free
            </Link>
          </div>

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
                'Everything in Free',
                'Roadmap & goal hierarchy',
                'Daily task planner',
                'Fuel & nutrition tracking',
                'The Engine (Focus timer, Debrief, Pain log)',
                'Analytics & insights',
                'AI Coach',
                'Gems collection',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-fuchsia-500 mt-0.5 flex-shrink-0" />
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
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border-2 border-gray-700 p-8 flex flex-col text-white">
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
                'All future features included',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-lime-400 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
              <li className="flex items-start gap-2 text-sm text-lime-300 font-semibold">
                <Shirt className="w-4 h-4 text-lime-400 mt-0.5 flex-shrink-0" />
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

        {/* Feature comparison note */}
        <div className="mt-8 bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-600">
            Have questions?{' '}
            <a href="mailto:support@centenarianos.com" className="text-fuchsia-600 hover:underline font-medium">
              Contact support
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
