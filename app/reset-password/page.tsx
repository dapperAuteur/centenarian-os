// File: app/reset-password/page.tsx
// Set a new password after clicking the email reset link.

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import SiteFooter from '@/components/ui/SiteFooter';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [noSession, setNoSession] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const supabase = createClient();

  const pwChecks = {
    length: password.length >= 10,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const pwValid = Object.values(pwChecks).every(Boolean);

  // Verify the user has an active session (from the reset link callback)
  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) setNoSession(true);
    }
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!pwValid) {
      setError('Password must be at least 10 characters with uppercase, lowercase, digit, and symbol.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
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

      {/* Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl p-8 bg-white shadow-xl">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Set new password</h1>
            <p className="text-gray-600 mt-2">Choose a strong password for your account.</p>
          </header>

          {noSession ? (
            <div className="space-y-6">
              <div className="bg-amber-50 text-amber-700 p-4 rounded-lg text-sm" role="alert">
                Your reset link has expired or is invalid. Please request a new one.
              </div>
              <Link
                href="/forgot-password"
                className="block w-full text-center text-white py-3 rounded-lg font-semibold transition duration-200 bg-sky-600 hover:bg-sky-700"
              >
                Request new reset link
              </Link>
            </div>
          ) : success ? (
            <div className="space-y-6">
              <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm">
                Your password has been updated. You can now log in with your new password.
              </div>
              <Link
                href="/login"
                className="block w-full text-center text-white py-3 rounded-lg font-semibold transition duration-200 bg-sky-600 hover:bg-sky-700"
              >
                Go to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm" role="alert">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium mb-1 text-gray-700">
                  New password
                </label>
                <input
                  id="new-password"
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
                        {pwChecks[key] ? '\u2713' : '\u2717'} {label}
                      </li>
                    ))}
                  </ul>
                )}
                {password.length === 0 && (
                  <p className="text-xs mt-1 text-gray-500" id="password-hint">Minimum 10 characters with upper, lower, digit, and symbol</p>
                )}
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium mb-1 text-gray-700">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={10}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent form-input border-gray-300 focus:ring-sky-500"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs mt-1 text-red-500">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !pwValid || password !== confirmPassword}
                className="w-full text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 bg-sky-600 hover:bg-sky-700"
              >
                {loading ? 'Updating...' : 'Reset password'}
              </button>

              <p className="text-center text-sm text-gray-600">
                <Link href="/login" className="font-medium text-sky-600 hover:underline">
                  Back to login
                </Link>
              </p>
            </form>
          )}
        </div>
      </main>

      <SiteFooter theme="light" />
    </div>
  );
}
