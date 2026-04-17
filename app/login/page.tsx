/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/login/page.tsx
// User authentication — password login OR email sign-in (magic link + 6-digit code).
// Supabase's email-OTP flow delivers BOTH a clickable magic link and a 6-digit
// code in the same email; users can choose whichever is more convenient. This
// page surfaces both paths and listens for the session that's established when
// the link is clicked (same tab OR another).
//
// Plan 34 Phase A — adds the magic-link UX without removing the existing
// password or OTP-code paths. Controlled by NEXT_PUBLIC_AUTH_EMAIL_ENABLED
// (default: enabled) so a delivery issue can be rolled back via env change
// without a redeploy.

'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import SiteFooter from '@/components/ui/SiteFooter';
import MfaVerifyStep from '@/components/login/MfaVerifyStep';
import { getAalAndFactors, needsMfaVerification } from '@/lib/mfa/helpers';

type LoginTab = 'password' | 'otp';
type OtpStep = 'email' | 'code';

// Feature flag — set NEXT_PUBLIC_AUTH_EMAIL_ENABLED=false at the platform
// level to hide the email-sign-in tab without shipping code. Default on.
const EMAIL_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_EMAIL_ENABLED !== 'false';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [tab, setTab] = useState<LoginTab>('password');

  // Password tab state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP tab state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const fromParam = searchParams.get('from');
  const dashboardRedirect = fromParam && fromParam.startsWith('/') ? fromParam : '/dashboard/planner';

  // Handle middleware redirect with ?mfa=pending
  useEffect(() => {
    if (searchParams.get('mfa') !== 'pending') return;
    async function checkMfa() {
      const { currentLevel, nextLevel, hasMfaEnabled } = await getAalAndFactors(supabase);
      if (hasMfaEnabled && needsMfaVerification(currentLevel, nextLevel)) {
        setMfaRequired(true);
      }
    }
    checkMfa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Magic-link support — when a user clicks the link in their email (this
  // tab or another), Supabase broadcasts a SIGNED_IN event. We catch it
  // and redirect to the dashboard without requiring the user to type the
  // 6-digit code. Only listens while on the code-entry step so we don't
  // fight the password form's own flow.
  useEffect(() => {
    if (tab !== 'otp' || otpStep !== 'code') return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // Let the MFA branch handle aal2 if required; otherwise redirect.
        getAalAndFactors(supabase).then(({ currentLevel, nextLevel }) => {
          if (needsMfaVerification(currentLevel, nextLevel)) {
            setMfaRequired(true);
          } else {
            router.push(dashboardRedirect);
            router.refresh();
          }
        });
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, otpStep, dashboardRedirect]);

  function switchTab(t: LoginTab) {
    setTab(t);
    setError('');
    setOtpError('');
    setOtpStep('email');
  }

  // ── Password login ──────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Check if MFA verification is needed
      const { currentLevel, nextLevel } = await getAalAndFactors(supabase);
      if (needsMfaVerification(currentLevel, nextLevel)) {
        setMfaRequired(true);
        return;
      }
      router.push(dashboardRedirect);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP: send code / magic link ─────────────────────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: {
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      setOtpStep('code');
    } catch (err: any) {
      setOtpError(err.message ?? 'Failed to send code');
    } finally {
      setOtpLoading(false);
    }
  };

  // ── OTP: verify code ────────────────────────────────────────────────────
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
      // Check if MFA verification is needed
      const { currentLevel, nextLevel } = await getAalAndFactors(supabase);
      if (needsMfaVerification(currentLevel, nextLevel)) {
        setMfaRequired(true);
        return;
      }
      router.push(dashboardRedirect);
      router.refresh();
    } catch (err: any) {
      setOtpError(err.message ?? 'Invalid code');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
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

      {/* Login Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl p-8 bg-white shadow-xl">
          {mfaRequired ? (
            <>
              <header className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
                <p className="text-gray-600 mt-2">Verify your identity to continue</p>
              </header>
              <MfaVerifyStep
                onVerified={() => {
                  router.push(dashboardRedirect);
                  router.refresh();
                }}
                onCancel={async () => {
                  await supabase.auth.signOut();
                  setMfaRequired(false);
                }}
              />
            </>
          ) : (
          <>
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-600 mt-2">Login to your journey</p>
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
            {EMAIL_AUTH_ENABLED && (
              <button
                type="button"
                onClick={() => switchTab('otp')}
                className={`flex-1 py-2 text-sm font-medium transition ${
                  tab === 'otp'
                    ? 'bg-sky-600 hover:bg-sky-700 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Email link
              </button>
            )}
          </div>

          {/* ── Password tab ──────────────────────────────────────────── */}
          {tab === 'password' && (
            <form onSubmit={handleLogin} className="space-y-6">
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
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent form-input border-gray-300 focus:ring-sky-500"
                  placeholder="••••••••"
                />
              </div>

              <div className="text-right">
                <Link href="/forgot-password" className="text-sm font-medium text-sky-600 hover:underline">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 bg-sky-600 hover:bg-sky-700"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <p className="text-center text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-medium text-sky-600 hover:underline">
                  Sign up
                </Link>
              </p>
            </form>
          )}

          {/* ── Email link tab ──────────────────────────────────────── */}
          {EMAIL_AUTH_ENABLED && tab === 'otp' && (
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
                    />
                    <p className="text-xs mt-1.5 text-gray-500">
                      We&apos;ll email you a <strong className="text-gray-700">sign-in link</strong> and a backup 6-digit code — use whichever is easier. Existing accounts only.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="w-full text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 bg-sky-600 hover:bg-sky-700"
                  >
                    {otpLoading ? 'Sending...' : 'Send sign-in link'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-6">
                  <div>
                    <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 mb-4 text-sm text-sky-900">
                      <p className="font-medium mb-1">Check your inbox — <span className="font-semibold">{otpEmail}</span></p>
                      <p className="text-sky-800">
                        <strong>Easiest:</strong> click the sign-in link in the email. You&rsquo;ll be signed in automatically and this page will redirect.
                      </p>
                      <p className="text-sky-800 mt-1">
                        <strong>Or:</strong> enter the 6-digit code below.
                      </p>
                    </div>
                    <label htmlFor="otp-code" className="block text-sm font-medium mb-1 text-gray-700">
                      6-digit code (optional if you clicked the link)
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
                    {otpLoading ? 'Verifying...' : 'Verify & Login'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setOtpStep('email'); setOtpCode(''); setOtpError(''); }}
                    className="w-full text-sm transition text-gray-500 hover:text-gray-700"
                  >
                    Use a different email
                  </button>
                </form>
              )}
            </div>
          )}
          </>
          )}
        </div>
      </main>

      <p className="text-center text-xs text-gray-400 pb-4">Part of the <a href="https://witus.online" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">WitUS platform</a></p>
      <SiteFooter theme="light" />
    </div>
  );
}
