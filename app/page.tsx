'use client';

import Link from 'next/link';
import { ArrowRight, Zap, Shield, TrendingUp, Heart, Menu, X } from 'lucide-react';
import { useState } from 'react';
import SiteFooter from '@/components/ui/SiteFooter';
import { useAuth } from '@/lib/hooks/useAuth';
import { MODULES } from '@/lib/features/modules';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const isLoggedIn = !authLoading && !!user;

  const dashboardHref = '/dashboard';
  const primaryLabel = isLoggedIn ? 'Go to Dashboard' : 'Get Started';
  const primaryHref = isLoggedIn ? dashboardHref : '/pricing';

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Header - Mobile First */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-linear-to-br from-fuchsia-500 to-sky-500 rounded-lg shrink-0"></div>
              <span className="text-lg sm:text-xl font-bold text-gray-900">CentenarianOS</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-4">
              <Link href="/features" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Features
              </Link>
              <Link href="/demo" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Demo
              </Link>
              <Link href="/academy" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Academy
              </Link>
              <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Blog
              </Link>
              <Link href="/recipes" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Recipes
              </Link>
              <Link href="/coaching" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Coaching
              </Link>
              <Link href="/tech-roadmap" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Roadmap
              </Link>
              <Link href="/contribute" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Contribute
              </Link>
              {!isLoggedIn && (
                <>
                  <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                    Login
                  </Link>
                  <Link href="/signup" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                    Sign Up
                  </Link>
                </>
              )}
              <Link
                href={primaryHref}
                className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-medium text-sm"
              >
                {primaryLabel}
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-h-11 min-w-11 flex items-center justify-center text-gray-600 hover:text-gray-900"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-4 pb-4 space-y-4">
              <Link
                href="/features"
                className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="/demo"
                className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Demo
              </Link>
              <Link
                href="/academy"
                className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Academy
              </Link>
              <Link
                href="/blog"
                className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Blog
              </Link>
              <Link
                href="/recipes"
                className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Recipes
              </Link>
              <Link
                href="/coaching"
                className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Coaching
              </Link>
              <Link
                href="/tech-roadmap"
                className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Tech Roadmap
              </Link>
              <Link
                href="/contribute"
                className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contribute
              </Link>
              {!isLoggedIn && (
                <>
                  <Link href="/login" className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 font-medium" onClick={() => setMobileMenuOpen(false)}>
                    Login
                  </Link>
                  <Link href="/signup" className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 font-medium" onClick={() => setMobileMenuOpen(false)}>
                    Sign Up
                  </Link>
                </>
              )}
              <Link
                href={primaryHref}
                className="w-full text-center min-h-11 flex items-center justify-center px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                {primaryLabel}
              </Link>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section - Mobile First */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 md:pt-20 pb-8 sm:pb-12 md:pb-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-4 sm:mb-6 leading-tight">
            Turn <span className="text-transparent bg-clip-text bg-linear-to-r from-fuchsia-600 to-sky-600">Multi-Decade Goals</span> Into Daily Action
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 px-2">
            The personal operating system for executing audacious, long-term goals through data-driven daily habits. Plan, fuel, track, and iterate—all in one place.
          </p>

          {/* Buttons - Stack on mobile, wrap on tablet+ */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 sm:gap-4 px-4 sm:px-0">
            <Link
              href={primaryHref}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-semibold text-base sm:text-lg flex items-center justify-center"
            >
              {isLoggedIn ? 'Go to Dashboard' : 'Start Your Journey'}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-white border-2 border-fuchsia-300 text-fuchsia-700 rounded-lg hover:bg-fuchsia-50 transition-colors font-semibold text-base sm:text-lg text-center"
            >
              Try the Demo
            </Link>
            <Link
              href="/tech-roadmap"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-semibold text-base sm:text-lg text-center"
            >
              View Tech Roadmap
            </Link>
          </div>
        </div>
      </section>

      {/* Coaching CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Link
          href="/coaching"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-linear-to-br from-fuchsia-950 to-indigo-950 text-white rounded-2xl px-6 py-5 hover:opacity-95 transition group"
          aria-label="Learn about personal longevity coaching"
        >
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300 mb-1">1-on-1 Coaching</p>
            <p className="text-lg sm:text-xl font-bold">Want expert guidance, not just tools?</p>
            <p className="text-sm text-fuchsia-200 mt-0.5">Personalized longevity coaching for executives, founders, and creative professionals.</p>
          </div>
          <span className="shrink-0 px-5 py-2.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap">
            Learn About Coaching
          </span>
        </Link>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-6 sm:mb-10">
          How It Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-14 h-14 bg-fuchsia-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-extrabold text-fuchsia-600">1</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Set Your Vision</h3>
            <p className="text-sm text-gray-600">Define multi-decade roadmaps and break them into goals, milestones, and daily tasks.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-extrabold text-sky-600">2</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Track Everything</h3>
            <p className="text-sm text-gray-600">Log meals, workouts, finances, trips, and health metrics. All modules link together.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 bg-lime-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-extrabold text-lime-600">3</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">See What Works</h3>
            <p className="text-sm text-gray-600">Discover correlations between habits and outcomes. Iterate with data, not guesswork.</p>
          </div>
        </div>
      </section>

      {/* All Modules */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-6 sm:mb-8 md:mb-12">
          Your Personal Operating System
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {MODULES.map((mod) => (
            <Link
              key={mod.slug}
              href={`/features/${mod.slug}`}
              className={`group bg-white rounded-2xl shadow-lg p-6 border-t-4 ${mod.color} hover:shadow-xl transition`}
            >
              <mod.Icon className={`w-10 h-10 ${mod.iconColor} mb-3`} />
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-fuchsia-600 transition">{mod.name}</h3>
              <p className="text-sm text-gray-600 mb-3">
                {mod.description}
              </p>
              <ul className="space-y-1.5 text-sm text-gray-600">
                {mod.features.map((f) => (
                  <li key={f} className="flex items-start">
                    <span className={`${mod.checkColor} mr-2 shrink-0`}>&check;</span>
                    {f}
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      </section>

      {/* Why CentenarianOS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <div className="bg-gray-100 rounded-2xl p-6 sm:p-8 md:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-6 sm:mb-8">
            Built for Real Life
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="flex items-start space-x-3 sm:space-x-4">
              <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-fuchsia-600 shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1 sm:mb-2 text-base sm:text-lg">Offline-First</h3>
                <p className="text-gray-600 text-sm">
                  Works without internet. Syncs automatically when connected.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 sm:space-x-4">
              <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-fuchsia-600 shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1 sm:mb-2 text-base sm:text-lg">Privacy-First</h3>
                <p className="text-gray-600 text-sm">
                  Your data encrypted at rest and in transit. No third-party sharing.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 sm:space-x-4">
              <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-fuchsia-600 shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1 sm:mb-2 text-base sm:text-lg">Data-Driven</h3>
                <p className="text-gray-600 text-sm">
                  Find correlations between habits and outcomes. Make informed adjustments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rise Wellness */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-2xl p-6 sm:p-8 md:p-10">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-6 h-6 text-fuchsia-600" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Mental Health Matters</h2>
          </div>
          <p className="text-gray-700 text-sm sm:text-base leading-relaxed mb-4 max-w-3xl">
            CentenarianOS is proud to collaborate with <strong>Rise Wellness of Indiana</strong>, an
            independent mental health provider offering compassionate, personalized, holistic care.
            Their evidence-based approach to anxiety, depression, ADHD, maternal mental health, and
            more supports our community&apos;s whole-person wellness journey.
          </p>
          <p className="text-gray-500 text-xs mb-5">
            Rise Wellness of Indiana is an independent organization, not affiliated with CentenarianOS, B4C LLC, or AwesomeWebStore.com.
          </p>
          <Link
            href="/safety#rise-wellness"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg font-semibold text-sm transition"
          >
            <Heart className="w-4 h-4" />
            Learn More &amp; Contact Rise Wellness
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <div className="bg-linear-to-r from-fuchsia-600 to-sky-600 rounded-2xl p-6 sm:p-8 md:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
            Start Your Centenarian Journey Today
          </h2>
          <p className="text-white/90 mb-6 sm:mb-8 text-base sm:text-lg max-w-2xl mx-auto px-2">
            Join the community and take control of your long-term goals, finances, health, and productivity.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-white text-fuchsia-600 rounded-lg hover:bg-gray-100 transition-colors font-bold text-base sm:text-lg"
            >
              {isLoggedIn ? 'Go to Dashboard' : 'View Plans & Get Started'}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-white/20 text-white border border-white/40 rounded-lg hover:bg-white/30 transition-colors font-semibold text-base sm:text-lg"
            >
              Try the Demo
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter theme="light" />
    </div>
  );
}
