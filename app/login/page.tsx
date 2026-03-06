/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/login/page.tsx
// User authentication — password login or email OTP (6-digit code).

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
      router.push('/dashboard/planner');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP: send code ──────────────────────────────────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: { shouldCreateUser: false },
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
      router.push('/dashboard/planner');
      router.refresh();
    } catch (err: any) {
      setOtpError(err.message ?? 'Invalid code');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-linear-to-br from-fuchsia-500 to-sky-500 rounded-lg shrink-0"></div>
              <span className="text-lg sm:text-xl font-bold text-gray-900">CentenarianOS</span>
            </Link>

            {/* Desktop Navigation */}
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

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
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
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          {mfaRequired ? (
            <>
              <header className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
                <p className="text-gray-600 mt-2">Verify your identity to continue</p>
              </header>
              <MfaVerifyStep
                onVerified={() => {
                  router.push('/dashboard/planner');
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
          <div className="flex mb-6 border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => switchTab('password')}
              className={`flex-1 py-2 text-sm font-medium transition ${
                tab === 'password'
                  ? 'bg-sky-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => switchTab('otp')}
              className={`flex-1 py-2 text-sm font-medium transition ${
                tab === 'otp'
                  ? 'bg-sky-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Email Code
            </button>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-600 text-white py-3 rounded-lg font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <p className="text-center text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-sky-600 hover:underline font-medium">
                  Sign up
                </Link>
              </p>
            </form>
          )}

          {/* ── Email Code tab ──────────────────────────────────────── */}
          {tab === 'otp' && (
            <div className="space-y-6">
              {otpError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm" role="alert">
                  {otpError}
                </div>
              )}

              {otpStep === 'email' ? (
                <form onSubmit={handleSendCode} className="space-y-6">
                  <div>
                    <label htmlFor="otp-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      id="otp-email"
                      type="email"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
                      placeholder="you@example.com"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      We&apos;ll send a 6-digit code to this address. Only existing accounts can use this method.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="w-full bg-sky-600 text-white py-3 rounded-lg font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
                  >
                    {otpLoading ? 'Sending...' : 'Send Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      A 6-digit code was sent to <span className="font-medium text-gray-900">{otpEmail}</span>.
                    </p>
                    <label htmlFor="otp-code" className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input text-center text-2xl tracking-widest font-mono"
                      placeholder="000000"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.length !== 6}
                    className="w-full bg-sky-600 text-white py-3 rounded-lg font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
                  >
                    {otpLoading ? 'Verifying...' : 'Verify & Login'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setOtpStep('email'); setOtpCode(''); setOtpError(''); }}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 transition"
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

      <SiteFooter theme="light" />
    </div>
  );
}
