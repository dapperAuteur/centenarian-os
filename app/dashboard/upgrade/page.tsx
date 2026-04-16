'use client';

// app/dashboard/upgrade/page.tsx
// Landing page that Starter subscribers hit when they try to access a
// module they didn't pick. Replaces the silent redirect to planner —
// same gate, but the user understands why they bounced and has a
// one-click path forward.
//
// Reads ?from=<moduleSlug> to personalize the copy. If the slug is
// missing or unknown, renders a generic "upgrade to unlock more"
// message — still useful when a user lands here by typing the URL
// directly.

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2, Lock, Shuffle, Sparkles, Star } from 'lucide-react';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { useToast } from '@/components/ui/ToastProvider';
import { logError } from '@/lib/error-logging';
import {
  STARTER_MODULES,
  isModuleSlug,
  type ModuleSlug,
} from '@/lib/access/starter-modules';

function UpgradePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { status, selectedModules } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState<'monthly' | 'lifetime' | null>(null);

  const fromRaw = searchParams.get('from') ?? '';
  const fromSlug: ModuleSlug | null = isModuleSlug(fromRaw) ? fromRaw : null;
  const fromModule = fromSlug ? STARTER_MODULES[fromSlug] : null;

  const picked = selectedModules ?? [];
  const isStarter = status === 'starter';

  async function handleCheckout(plan: 'monthly' | 'lifetime') {
    setCheckoutLoading(plan);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Could not start checkout.');
      }
      window.location.href = data.url;
    } catch (err) {
      logError(err, { module: 'UpgradePage', context: { op: 'checkout', plan } });
      toast.error(err instanceof Error ? err.message : 'Could not start checkout.');
      setCheckoutLoading(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-fuchsia-100 text-fuchsia-600 mb-4">
          <Lock className="w-7 h-7" aria-hidden="true" />
        </div>
        {fromModule ? (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Unlock {fromModule.label}
            </h1>
            <p className="text-gray-600 text-sm sm:text-base max-w-xl mx-auto">
              {fromModule.description}. It&rsquo;s not one of your picked Starter modules — choose a path below.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Upgrade your plan
            </h1>
            <p className="text-gray-600 text-sm sm:text-base max-w-xl mx-auto">
              Get access to more of CentenarianOS.
            </p>
          </>
        )}
      </header>

      {isStarter && picked.length > 0 && (
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5 mb-6">
          <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2">Your current Starter modules</p>
          <ul className="flex flex-wrap gap-2" role="list">
            {picked.map((slug) => {
              const mod = isModuleSlug(slug) ? STARTER_MODULES[slug] : null;
              return (
                <li key={slug} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700">
                  <Sparkles className="w-3.5 h-3.5 text-fuchsia-500" aria-hidden="true" />
                  {mod?.label ?? slug}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Swap a module — Starter users only */}
        {isStarter && (
          <button
            type="button"
            onClick={() => router.push('/pricing?action=swap')}
            className="min-h-11 text-left p-5 bg-white border-2 border-gray-200 hover:border-sky-400 rounded-2xl transition group"
          >
            <Shuffle className="w-6 h-6 text-sky-500 mb-3" aria-hidden="true" />
            <h2 className="text-base font-bold text-gray-900 mb-1">Swap a module</h2>
            <p className="text-xs text-gray-600 mb-3">
              Keep Starter, change one of your three picks to{' '}
              {fromModule ? <span className="font-semibold">{fromModule.label}</span> : 'something else'}. Takes effect immediately.
            </p>
            <span className="inline-flex items-center gap-1 text-sm text-sky-600 font-semibold group-hover:gap-2 transition-all">
              Pick modules <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </span>
          </button>
        )}

        {/* Upgrade to Monthly Pro */}
        <button
          type="button"
          onClick={() => handleCheckout('monthly')}
          disabled={checkoutLoading !== null}
          className="min-h-11 text-left p-5 bg-white border-2 border-sky-500 hover:border-sky-600 rounded-2xl transition group disabled:opacity-50"
        >
          <Star className="w-6 h-6 text-sky-500 mb-3" aria-hidden="true" />
          <h2 className="text-base font-bold text-gray-900 mb-1">Pro — all modules</h2>
          <p className="text-xs text-gray-600 mb-3">
            $10.60/mo. Unlock every module. Cancel anytime.
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-sky-600 font-semibold">
            {checkoutLoading === 'monthly' ? (
              <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Starting…</>
            ) : (
              <>Upgrade to Pro <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" /></>
            )}
          </span>
        </button>

        {/* Upgrade to Lifetime */}
        <button
          type="button"
          onClick={() => handleCheckout('lifetime')}
          disabled={checkoutLoading !== null}
          className="min-h-11 text-left p-5 bg-gradient-to-br from-fuchsia-50 to-sky-50 border-2 border-fuchsia-400 hover:border-fuchsia-500 rounded-2xl transition group disabled:opacity-50"
        >
          <Sparkles className="w-6 h-6 text-fuchsia-500 mb-3" aria-hidden="true" />
          <h2 className="text-base font-bold text-gray-900 mb-1">Lifetime</h2>
          <p className="text-xs text-gray-600 mb-3">
            $103.29 once. Every module forever. Founder&rsquo;s price, first 100.
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-fuchsia-600 font-semibold">
            {checkoutLoading === 'lifetime' ? (
              <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Starting…</>
            ) : (
              <>Get Lifetime <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" /></>
            )}
          </span>
        </button>
      </div>

      <footer className="mt-8 text-center">
        <Link
          href="/dashboard/planner"
          className="min-h-11 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Maybe later — back to my dashboard
        </Link>
      </footer>

      <p className="mt-6 text-xs text-gray-400 text-center">
        Your data stays intact when you change plans. A locked module&rsquo;s data is hidden, not deleted — re-select it anytime and everything is back.
      </p>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-500">Loading…</div>}>
      <UpgradePageInner />
    </Suspense>
  );
}
