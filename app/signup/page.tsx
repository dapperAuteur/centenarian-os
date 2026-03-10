/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/signup/page.tsx
// New user registration with Cloudflare Turnstile bot prevention.

'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { Menu, X } from 'lucide-react';
import SiteFooter from '@/components/ui/SiteFooter';

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

  const pwChecks = {
    length: password.length >= 10,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const pwValid = Object.values(pwChecks).every(Boolean);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

    if (!agreedToTerms) {
      setError('Please agree to the Terms of Use and Privacy Policy to continue.');
      return;
    }

    if (!pwValid) {
      setError('Password must be at least 10 characters with uppercase, lowercase, digit, and symbol.');
      return;
    }

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
      const emailRedirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent('/dashboard/planner')}`
        : undefined;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });
      if (error) throw error;

      router.push('/pricing?from=signup');
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

      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-linear-to-br from-fuchsia-500 to-sky-500 rounded-lg shrink-0"></div>
                <span className="text-lg sm:text-xl font-bold text-gray-900">CentenarianOS</span>
              </Link>

              <div className="hidden md:flex items-center space-x-6">
                <Link href="/demo" className="text-gray-600 hover:text-gray-900 font-medium">Demo</Link>
                <Link href="/academy" className="text-gray-600 hover:text-gray-900 font-medium">Academy</Link>
                <Link href="/blog" className="text-gray-600 hover:text-gray-900 font-medium">Blog</Link>
                <Link href="/recipes" className="text-gray-600 hover:text-gray-900 font-medium">Recipes</Link>
                <Link href="/coaching" className="text-gray-600 hover:text-gray-900 font-medium">Coaching</Link>
                <Link href="/tech-roadmap" className="text-gray-600 hover:text-gray-900 font-medium">Tech Roadmap</Link>
                <Link href="/contribute" className="text-gray-600 hover:text-gray-900 font-medium">Contribute</Link>
                <Link href="/pricing" className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-medium">
                  Get Started
                </Link>
              </div>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-900"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

            {mobileMenuOpen && (
              <div className="md:hidden mt-4 pb-4 space-y-4">
                <Link href="/demo" className="block text-gray-600 hover:text-gray-900 font-medium" onClick={() => setMobileMenuOpen(false)}>Demo</Link>
                <Link href="/academy" className="block text-gray-600 hover:text-gray-900 font-medium" onClick={() => setMobileMenuOpen(false)}>Academy</Link>
                <Link href="/blog" className="block text-gray-600 hover:text-gray-900 font-medium" onClick={() => setMobileMenuOpen(false)}>Blog</Link>
                <Link href="/recipes" className="block text-gray-600 hover:text-gray-900 font-medium" onClick={() => setMobileMenuOpen(false)}>Recipes</Link>
                <Link href="/coaching" className="block text-gray-600 hover:text-gray-900 font-medium" onClick={() => setMobileMenuOpen(false)}>Coaching</Link>
                <Link href="/tech-roadmap" className="block text-gray-600 hover:text-gray-900 font-medium" onClick={() => setMobileMenuOpen(false)}>Tech Roadmap</Link>
                <Link href="/contribute" className="block text-gray-600 hover:text-gray-900 font-medium" onClick={() => setMobileMenuOpen(false)}>Contribute</Link>
                <Link
                  href="/pricing"
                  className="block w-full text-center px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            )}
          </nav>
        </header>

        {/* Signup Form */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl p-8 bg-white shadow-xl">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Create your account</h1>
              <p className="text-gray-600 mt-2">Begin your multi-decade journey</p>
            </header>

            <form onSubmit={handleSignup} className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm" role="alert">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1 text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent form-input border-gray-300 focus:ring-sky-500"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1 text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent form-input border-gray-300 focus:ring-sky-500"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                {password.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs" id="password-hint">
                    {([
                      ['length', '10+ characters'],
                      ['upper', 'Uppercase letter'],
                      ['lower', 'Lowercase letter'],
                      ['digit', 'Number'],
                      ['symbol', 'Symbol (!@#$…)'],
                    ] as const).map(([key, label]) => (
                      <li key={key} className={pwChecks[key] ? 'text-green-600' : 'text-red-500'}>
                        {pwChecks[key] ? '✓' : '✗'} {label}
                      </li>
                    ))}
                  </ul>
                )}
                {password.length === 0 && (
                  <p className="text-xs mt-1 text-gray-500" id="password-hint">Minimum 10 characters with upper, lower, digit, and symbol</p>
                )}
              </div>

              <div className="flex items-start gap-3">
                <input
                  id="agree-terms"
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded shrink-0 border-gray-300 focus:ring-sky-500"
                />
                <label htmlFor="agree-terms" className="text-sm cursor-pointer text-gray-600">
                  I agree to the{' '}
                  <Link href="/terms" className="font-medium text-sky-600 hover:underline" target="_blank">
                    Terms of Use
                  </Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="font-medium text-sky-600 hover:underline" target="_blank">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {/* Cloudflare Turnstile widget — only rendered when site key is configured */}
              {siteKey && (
                <div id="turnstile-widget" className="flex justify-center" />
              )}

              <button
                type="submit"
                disabled={loading || !agreedToTerms || !pwValid || (!!siteKey && !turnstileToken)}
                className="w-full text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 bg-sky-600 hover:bg-sky-700"
              >
                {loading ? 'Creating account…' : 'Sign up'}
              </button>

              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-sky-600 hover:underline">
                  Login
                </Link>
              </p>
            </form>
          </div>
        </main>

        <SiteFooter theme="light" />
      </div>
    </>
  );
}
