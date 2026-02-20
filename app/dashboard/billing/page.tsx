'use client';

// app/dashboard/billing/page.tsx
// Billing & subscription management page

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { CheckCircle, Shirt, CreditCard, Zap, ArrowRight, Copy, Check, Shield } from 'lucide-react';

const POLICIES = 'No Refunds. Cancel Anytime. Monthly fees are not transferable to lifetime membership.';

export default function BillingPage() {
  const { status, shirtPromoCode, cancelAtPeriodEnd, cancelAt, subscriptionExpiresAt, loading } = useSubscription();
  const searchParams = useSearchParams();
  const justPaid = searchParams.get('success') === 'true';
  const sessionId = searchParams.get('session_id');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncLoading, setSyncLoading] = useState(!!sessionId);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin ?? false))
      .catch(() => {});
  }, []);

  // When arriving from Stripe with a session_id, sync subscription status directly
  useEffect(() => {
    if (!sessionId) return;

    fetch('/api/stripe/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          console.error('[billing] Sync failed:', data);
          setSyncError(data.error ?? 'Subscription sync failed. Please contact support.');
          setSyncLoading(false);
        } else {
          console.log('[billing] Sync result:', data);
          // Hard reload without session_id — ensures fresh subscription state from DB
          window.location.replace('/dashboard/billing?success=true');
        }
      })
      .catch((err) => {
        console.error('[billing] Sync network error:', err);
        setSyncError('Could not connect to sync service. Please refresh the page.');
        setSyncLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function openPortal() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to open portal');
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Something went wrong');
      setPortalLoading(false);
    }
  }

  function copyPromoCode() {
    if (!shirtPromoCode) return;
    navigator.clipboard.writeText(shirtPromoCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading || syncLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
        {syncLoading && (
          <p className="text-sm text-gray-500">Confirming your payment&hellip;</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing</h1>
      <p className="text-gray-500 mb-8">Manage your subscription and membership.</p>

      {/* Sync error banner */}
      {syncError && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">
          <span className="font-semibold shrink-0">Sync error:</span>
          <span>{syncError}</span>
        </div>
      )}

      {/* Success banner */}
      {justPaid && !syncError && (
        <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-xl px-5 py-4">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">Payment successful — welcome to CentenarianOS!</span>
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Current Plan</h2>

        {isAdmin && (
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-fuchsia-600 shrink-0" />
            <div>
              <span className="text-lg font-bold text-fuchsia-700">Admin — Full Access</span>
              <p className="text-sm text-gray-500 mt-1">You have unrestricted access to all features.</p>
            </div>
          </div>
        )}

        {!isAdmin && status === 'free' && (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="inline-flex items-center gap-2 text-lg font-bold text-gray-700">
                Free
              </span>
              <p className="text-sm text-gray-500 mt-1">Blog and Recipes access only.</p>
            </div>
            <Link
              href="/pricing"
              className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors text-sm font-semibold"
            >
              <Zap className="w-4 h-4" />
              Upgrade
            </Link>
          </div>
        )}

        {status === 'monthly' && (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="inline-flex items-center gap-2 text-lg font-bold text-fuchsia-700">
                <Zap className="w-5 h-5" />
                Monthly — $10/month
              </span>
              {cancelAtPeriodEnd && cancelAt ? (
                <p className="text-sm text-amber-600 font-medium mt-1">
                  Cancels on {new Date(cancelAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              ) : subscriptionExpiresAt ? (
                <p className="text-sm text-gray-500 mt-1">
                  Renews on {new Date(subscriptionExpiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-1">Full access. Cancel anytime via the portal.</p>
              )}
            </div>
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold disabled:opacity-60"
            >
              {portalLoading ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              Manage Subscription
            </button>
          </div>
        )}

        {status === 'lifetime' && (
          <div>
            <span className="inline-flex items-center gap-2 text-lg font-bold text-lime-700">
              <CheckCircle className="w-5 h-5" />
              Lifetime Member
            </span>
            <p className="text-sm text-gray-500 mt-1">Full access forever. No recurring charges.</p>
          </div>
        )}

        {portalError && (
          <p className="mt-3 text-sm text-red-600">{portalError}</p>
        )}
      </div>

      {/* Shirt promo code pending — Shopify API may still be generating it */}
      {status === 'lifetime' && !shirtPromoCode && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Shirt className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-amber-800">Shirt Promo Code Pending</h2>
          </div>
          <p className="text-sm text-amber-700">
            Your unique promo code is being generated — please refresh this page in a moment.
            If it still doesn&apos;t appear after a minute, contact support.
          </p>
        </div>
      )}

      {/* Shirt promo code — only shown to lifetime members */}
      {status === 'lifetime' && shirtPromoCode && (
        <div className="bg-linear-to-br from-lime-50 to-emerald-50 border border-lime-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Shirt className="w-5 h-5 text-lime-700" />
            <h2 className="font-bold text-lime-800">Your Free Shirt Promo Code</h2>
          </div>
          <p className="text-sm text-lime-700 mb-4">
            Use this code at{' '}
            <a
              href="https://AwesomeWebStore.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              AwesomeWebStore.com
            </a>{' '}
            to claim your free CentenarianOS shirt.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-white border border-lime-300 rounded-lg px-4 py-3 text-lg font-mono font-bold text-lime-900 tracking-widest">
              {shirtPromoCode}
            </code>
            <button
              onClick={copyPromoCode}
              className="flex items-center gap-1.5 px-4 py-3 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors text-sm font-semibold"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Upgrade to lifetime CTA for monthly members */}
      {status === 'monthly' && (
        <div className="bg-gray-900 text-white rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <Shirt className="w-5 h-5 text-lime-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold mb-1">Upgrade to Lifetime for $100</h3>
              <p className="text-sm text-gray-400 mb-4">
                Pay once, own it forever — plus get a free CentenarianOS shirt from AwesomeWebStore.com.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-4 py-2 bg-lime-500 text-gray-900 rounded-lg hover:bg-lime-400 transition-colors text-sm font-bold"
              >
                View Lifetime Plan
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Policies */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-4">
        <p className="text-sm text-gray-500 font-medium">{POLICIES}</p>
      </div>
    </div>
  );
}
