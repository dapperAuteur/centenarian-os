/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/login/page.tsx
// User authentication

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import SiteFooter from '@/components/ui/SiteFooter';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

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
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-600 mt-2">Login to your journey</p>
          </header>

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
        </div>
      </main>

      <SiteFooter theme="light" />
    </div>
  );
}
