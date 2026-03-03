'use client';

import Link from 'next/link';
import { ArrowRight, Target, Utensils, Brain, Car, DollarSign, Heart, GraduationCap, BookOpen, TrendingUp, Zap, Shield, Menu, X, Dumbbell, Package, Database, ChartNetwork } from 'lucide-react';
import { useState } from 'react';
import SiteFooter from '@/components/ui/SiteFooter';
import { useAuth } from '@/lib/hooks/useAuth';

const MODULES = [
  {
    name: 'The Planner',
    color: 'border-fuchsia-500',
    iconColor: 'text-fuchsia-600',
    checkColor: 'text-fuchsia-600',
    Icon: Target,
    description: 'Hierarchical goal tracking from multi-decade roadmaps down to daily tasks.',
    features: [
      'Roadmap \u2192 Goals \u2192 Milestones \u2192 Tasks',
      'Week/3-day/daily views',
      'Real-time progress tracking',
    ],
  },
  {
    name: 'The Fuel',
    color: 'border-sky-500',
    iconColor: 'text-sky-600',
    checkColor: 'text-sky-600',
    Icon: Utensils,
    description: 'Nutrition tracking with the NCV framework. Optimize for performance and longevity.',
    features: [
      'Ingredient library with cost tracking',
      'Green/Yellow/Red scoring',
      'Recipe import from any URL',
      'Auto inventory management',
    ],
  },
  {
    name: 'The Engine',
    color: 'border-lime-500',
    iconColor: 'text-lime-600',
    checkColor: 'text-lime-600',
    Icon: Brain,
    description: 'Focus tracking, Pomodoro timers, and daily debriefs to maintain momentum.',
    features: [
      'Pomodoro focus sessions linked to tasks',
      'Daily energy/focus ratings',
      'Body check & pain tracking',
      'Weekly AI-powered reviews',
    ],
  },
  {
    name: 'Travel & Vehicles',
    color: 'border-amber-500',
    iconColor: 'text-amber-600',
    checkColor: 'text-amber-600',
    Icon: Car,
    description: 'Track every mile, fuel-up, and the real cost of getting around.',
    features: [
      'Vehicle profiles & fuel logging with OCR',
      'Trip tracking (car, bike, walk, run)',
      'Bike savings vs. car cost-per-mile',
      'Garmin activity import',
    ],
  },
  {
    name: 'Financial Dashboard',
    color: 'border-emerald-500',
    iconColor: 'text-emerald-600',
    checkColor: 'text-emerald-600',
    Icon: DollarSign,
    description: 'Full financial tracking — accounts, budgets, brands, invoices, and P&L reporting.',
    features: [
      'Checking, savings, credit card, loan, cash',
      'Budget categories with spending charts',
      'Brand / business P&L tracking',
      'Invoices with custom fields & CSV import',
    ],
  },
  {
    name: 'Health Metrics',
    color: 'border-rose-500',
    iconColor: 'text-rose-600',
    checkColor: 'text-rose-600',
    Icon: Heart,
    description: 'Daily vitals logging and wearable integration for the full health picture.',
    features: [
      'RHR, steps, sleep, activity minutes',
      'Garmin, Oura Ring & WHOOP sync',
      'Body composition tracking',
      'CSV import (Apple Health, InBody)',
    ],
  },
  {
    name: 'Workouts & Exercises',
    color: 'border-cyan-500',
    iconColor: 'text-cyan-600',
    checkColor: 'text-cyan-600',
    Icon: Dumbbell,
    description: 'Build custom workout templates from a personal exercise library.',
    features: [
      'Exercise library with categories & muscle groups',
      'Workout templates with sets/reps/weight',
      'Workout log with effort & mood ratings',
      'CSV import/export via Data Hub',
    ],
  },
  {
    name: 'Equipment & Assets',
    color: 'border-stone-500',
    iconColor: 'text-stone-600',
    checkColor: 'text-stone-600',
    Icon: Package,
    description: 'Track tools, gear, and possessions — purchase price, current value, and cross-module links.',
    features: [
      'Equipment categories with auto-seeding',
      'Valuation history with chart visualization',
      'Link equipment to trips, workouts, finance',
      'Total asset value dashboard',
    ],
  },
  {
    name: 'Academy',
    color: 'border-violet-500',
    iconColor: 'text-violet-600',
    checkColor: 'text-violet-600',
    Icon: GraduationCap,
    description: 'A full LMS — create, publish, sell, and take courses.',
    features: [
      'Video, text, audio, quiz & map lessons',
      'Choose Your Own Adventure navigation',
      'Assignments, certificates & badges',
      '14 free tutorial course series',
    ],
  },
  {
    name: 'Blog & Recipes',
    color: 'border-orange-500',
    iconColor: 'text-orange-600',
    checkColor: 'text-orange-600',
    Icon: BookOpen,
    description: 'Community content publishing with rich text and recipe sharing.',
    features: [
      'Rich text editor with media upload',
      'Public recipe pages with likes & saves',
      'Recipe import from any URL',
      'Public author/cook profiles',
    ],
  },
  {
    name: 'Correlations & Analytics',
    color: 'border-teal-500',
    iconColor: 'text-teal-600',
    checkColor: 'text-teal-600',
    Icon: TrendingUp,
    description: 'Find connections between habits, nutrition, and health outcomes.',
    features: [
      'Cross-module data correlation engine',
      'Daily & weekly aggregate views',
      'Trend charts across all tracked metrics',
      'Actionable insight summaries',
    ],
  },
  {
    name: 'Data Hub',
    color: 'border-indigo-500',
    iconColor: 'text-indigo-600',
    checkColor: 'text-indigo-600',
    Icon: Database,
    description: 'Centralized import and export for every module — your data, your way.',
    features: [
      'CSV import/export for all 12+ modules',
      'Date-range filtering on exports',
      'Google Sheets compatible templates',
      'Bulk course importer for Academy',
    ],
  },
  {
    name: 'Cross-Module Connections',
    color: 'border-pink-500',
    iconColor: 'text-pink-600',
    checkColor: 'text-pink-600',
    Icon: ChartNetwork,
    description: 'Link data across every module — activities, contacts, and locations.',
    features: [
      'Bidirectional activity links (task\u2194trip\u2194equipment)',
      'Saved contacts with location sub-entries',
      'Contact autocomplete with default category',
      'Task contacts & location assignment',
    ],
  },
];

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
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/demo" className="text-gray-600 hover:text-gray-900 font-medium">
                Demo
              </Link>
              <Link href="/academy" className="text-gray-600 hover:text-gray-900 font-medium">
                Academy
              </Link>
              <Link href="/blog" className="text-gray-600 hover:text-gray-900 font-medium">
                Blog
              </Link>
              <Link href="/recipes" className="text-gray-600 hover:text-gray-900 font-medium">
                Recipes
              </Link>
              <Link href="/coaching" className="text-gray-600 hover:text-gray-900 font-medium">
                Coaching
              </Link>
              <Link href="/tech-roadmap" className="text-gray-600 hover:text-gray-900 font-medium">
                Tech Roadmap
              </Link>
              <Link href="/contribute" className="text-gray-600 hover:text-gray-900 font-medium">
                Contribute
              </Link>
              <Link
                href={primaryHref}
                className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-medium"
              >
                {primaryLabel}
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 space-y-4">
              <Link
                href="/demo"
                className="block text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Demo
              </Link>
              <Link
                href="/academy"
                className="block text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Academy
              </Link>
              <Link
                href="/blog"
                className="block text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Blog
              </Link>
              <Link
                href="/recipes"
                className="block text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Recipes
              </Link>
              <Link
                href="/coaching"
                className="block text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Coaching
              </Link>
              <Link
                href="/tech-roadmap"
                className="block text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Tech Roadmap
              </Link>
              <Link
                href="/contribute"
                className="block text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contribute
              </Link>
              <Link
                href={primaryHref}
                className="block w-full text-center px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-medium"
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

      {/* All Modules */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-6 sm:mb-8 md:mb-12">
          Your Personal Operating System
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {MODULES.map((mod) => (
            <div key={mod.name} className={`bg-white rounded-2xl shadow-lg p-6 border-t-4 ${mod.color}`}>
              <mod.Icon className={`w-10 h-10 ${mod.iconColor} mb-3`} />
              <h3 className="text-lg font-bold text-gray-900 mb-2">{mod.name}</h3>
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
            </div>
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
