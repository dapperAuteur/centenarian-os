/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/signup/page.tsx
// New user registration — password signup or email-only OTP (6-digit code).

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

type SignupTab = 'password' | 'email';
type OtpStep = 'email' | 'code';

export default function SignupPage() {
  const [tab, setTab] = useState<SignupTab>('password');

  // Password tab state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Email-only (OTP) tab state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

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

  function resetTurnstile() {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
    setTurnstileToken(null);
  }

  function switchTab(t: SignupTab) {
    setTab(t);
    setError('');
    setOtpError('');
    setOtpStep('email');
    setOtpCode('');
    resetTurnstile();
  }

  // Shared Turnstile verification helper
  async function verifyTurnstile(setErr: (msg: string) => void): Promise<boolean> {
    if (!siteKey) return true;
    if (!turnstileToken) {
      setErr('Please complete the human verification below.');
      return false;
    }
    try {
      const res = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: turnstileToken }),
      });
      const data = await res.json();
      if (!data.success) {
        setErr(data.error ?? 'Verification failed. Please try again.');
        resetTurnstile();
        return false;
      }
      return true;
    } catch {
      setErr('Could not verify. Please refresh and try again.');
      return false;
    }
  }

  // ── Password signup ────────────────────────────────────────────────────
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

    setLoading(true);
    const ok = await verifyTurnstile(setError);
    if (!ok) { setLoading(false); return; }

    try {
      const emailRedirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent('/dashboard/planner')}`
        : undefined;

      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
      if (error) throw error;

      router.push('/pricing?from=signup');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Email-only: send OTP code ──────────────────────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');

    if (!agreedToTerms) {
      setOtpError('Please agree to the Terms of Use and Privacy Policy to continue.');
      return;
    }

    setOtpLoading(true);
    const ok = await verifyTurnstile(setOtpError);
    if (!ok) { setOtpLoading(false); return; }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setOtpStep('code');
    } catch (err: any) {
      setOtpError(err.message ?? 'Failed to send code');
      resetTurnstile();
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Email-only: verify OTP code ────────────────────────────────────────
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otpCode,
        type: 'email',
      });
      if (error) throw error;
      router.push('/pricing?from=signup');
      router.refresh();
    } catch (err: any) {
      setOtpError(err.message ?? 'Invalid code');
    } finally {
      setOtpLoading(false);
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
            <header className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Create your account</h1>
              <p className="text-gray-600 mt-2">Begin your multi-decade journey</p>
            </header>

            {/* Tabs */}
            <div className="flex mb-6 border rounded-lg overflow-hidden border-gray-200">
              <button
                type="button"
                onClick={() => switchTab('password')}
                className={`flex-1 py-2 text-sm font-medium transition ${
                  tab === 'password'
                    ? 'bg-sky-600 hover:bg-sky-700 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => switchTab('email')}
                className={`flex-1 py-2 text-sm font-medium transition ${
                  tab === 'email'
                    ? 'bg-sky-600 hover:bg-sky-700 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Email Only
              </button>
            </div>

            {/* ── Password tab ──────────────────────────────────────────── */}
            {tab === 'password' && (
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

                {siteKey && <div id="turnstile-widget" className="flex justify-center" />}

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
            )}

            {/* ── Email-only tab ─────────────────────────────────────────── */}
            {tab === 'email' && (
              <div className="space-y-6">
                {otpError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm" role="alert">
                    {otpError}
                  </div>
                )}

                {otpStep === 'email' ? (
                  <form onSubmit={handleSendCode} className="space-y-6">
                    <div>
                      <label htmlFor="otp-email" className="block text-sm font-medium mb-1 text-gray-700">
                        Email
                      </label>
                      <input
                        id="otp-email"
                        type="email"
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent form-input border-gray-300 focus:ring-sky-500"
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                      <p className="text-xs mt-1.5 text-gray-400">
                        We&apos;ll send a 6-digit code to this address. No password needed.
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <input
                        id="agree-terms-otp"
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded shrink-0 border-gray-300 focus:ring-sky-500"
                      />
                      <label htmlFor="agree-terms-otp" className="text-sm cursor-pointer text-gray-600">
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

                    {siteKey && <div id="turnstile-widget" className="flex justify-center" />}

                    <button
                      type="submit"
                      disabled={otpLoading || !agreedToTerms || (!!siteKey && !turnstileToken)}
                      className="w-full text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 bg-sky-600 hover:bg-sky-700"
                    >
                      {otpLoading ? 'Sending…' : 'Send Code'}
                    </button>

                    <p className="text-center text-sm text-gray-600">
                      Already have an account?{' '}
                      <Link href="/login" className="font-medium text-sky-600 hover:underline">
                        Login
                      </Link>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyCode} className="space-y-6">
                    <div>
                      <p className="text-sm mb-4 text-gray-600">
                        We sent a 6-digit code to <span className="font-medium text-gray-900">{otpEmail}</span>. Enter it below to create your account.
                      </p>
                      <label htmlFor="otp-code" className="block text-sm font-medium mb-1 text-gray-700">
                        6-digit code
                      </label>
                      <input
                        id="otp-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        autoFocus
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent form-input text-center text-2xl tracking-widest font-mono border-gray-300 focus:ring-sky-500"
                        placeholder="000000"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={otpLoading || otpCode.length !== 6}
                      className="w-full text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 bg-sky-600 hover:bg-sky-700"
                    >
                      {otpLoading ? 'Verifying…' : 'Verify & Create Account'}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setOtpStep('email'); setOtpCode(''); setOtpError(''); resetTurnstile(); }}
                      className="w-full text-sm transition text-gray-500 hover:text-gray-700"
                    >
                      Use a different email
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </main>

        <p className="text-center text-xs text-gray-400 pb-4">
          Your CentenarianOS account also works on{' '}
          <a href="https://work.witus.online" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">
            Work.WitUS.Online
          </a>{' '}
          &mdash; powered by WitUS.online
        </p>
        <SiteFooter theme="light" />
      </div>
    </>
  );
}
