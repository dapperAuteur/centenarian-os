/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/signup/page.tsx
// New user registration with Cloudflare Turnstile bot prevention.

'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Render Turnstile widget once the script loads
  function onTurnstileLoad() {
    if (!window.turnstile || !siteKey) return;
    widgetIdRef.current = window.turnstile.render('#turnstile-widget', {
      sitekey: siteKey,
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(null),
      'error-callback': () => setTurnstileToken(null),
      theme: 'light',
    });
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Skip Turnstile if no site key configured (dev environment)
    if (siteKey) {
      if (!turnstileToken) {
        setError('Please complete the human verification below.');
        return;
      }

      setLoading(true);
      try {
        const verifyRes = await fetch('/api/auth/verify-turnstile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          setError(verifyData.error ?? 'Verification failed. Please try again.');
          // Reset widget so user can retry
          if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
          setTurnstileToken(null);
          setLoading(false);
          return;
        }
      } catch {
        setError('Could not verify. Please refresh and try again.');
        setLoading(false);
        return;
      }
    } else {
      setLoading(true);
    }

    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      router.push('/dashboard/planner');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
          onLoad={onTurnstileLoad}
        />
      )}
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <header className="mb-8">
            <Link href="/" className="flex items-center space-x-2">
              <h1 className="text-3xl font-bold text-gray-900">CentenarianOS</h1>
            </Link>
            <p className="text-gray-600 mt-2">Begin your multi-decade journey</p>
          </header>

          <form onSubmit={handleSignup} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>

            {/* Cloudflare Turnstile widget — only rendered when site key is configured */}
            {siteKey && (
              <div id="turnstile-widget" className="flex justify-center" />
            )}

            <button
              type="submit"
              disabled={loading || (!!siteKey && !turnstileToken)}
              className="w-full bg-sky-600 text-white py-3 rounded-lg font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            >
              {loading ? 'Creating account…' : 'Sign up'}
            </button>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-sky-600 hover:underline font-medium">
                Login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
