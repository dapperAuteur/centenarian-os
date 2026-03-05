'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Play, DollarSign, Car, BookOpen, Users, Wrench, Shield, Target, Brain, Heart, Dumbbell, Package, Camera, Tag, Database, TrendingUp, History } from 'lucide-react';
import SiteFooter from '@/components/ui/SiteFooter';

export default function DemoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDemoLogin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'demo-page' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Demo login failed');
      router.push(data.redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Back to Home</span>
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-linear-to-br from-fuchsia-500 to-sky-500 rounded-lg shrink-0" />
            <span className="text-xl font-bold text-gray-900">CentenarianOS</span>
          </div>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
            Try CentenarianOS — No Account Needed
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Explore a fully loaded demo account with realistic financial data, travel logs, fuel records, and more. See how the platform works before committing.
          </p>
        </div>

        {/* Demo Login CTA */}
        <div className="bg-linear-to-r from-fuchsia-600 to-sky-600 rounded-2xl p-6 sm:p-8 text-center mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
            Jump Right In
          </h2>
          <p className="text-white/90 mb-6 text-sm sm:text-base">
            One click to explore the full dashboard with pre-loaded data.
          </p>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm max-w-md mx-auto">
              {error}
            </div>
          )}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="inline-flex items-center px-8 py-4 bg-white text-fuchsia-600 rounded-lg hover:bg-gray-100 transition-colors font-bold text-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="animate-spin inline-block w-5 h-5 border-2 border-fuchsia-600 border-t-transparent rounded-full mr-2" />
            ) : (
              <Play className="w-5 h-5 mr-2" />
            )}
            {loading ? 'Logging in...' : 'Login as Demo User'}
          </button>
          <div className="mt-4 space-y-1">
            <p className="text-white/70 text-xs flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              Shared account. Data resets daily.
            </p>
            <p className="text-white/70 text-xs">
              Do not enter personal information in the demo account.
            </p>
          </div>
        </div>

        {/* What You'll Explore */}
        <section className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">
            What You&apos;ll Explore
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <DollarSign className="w-8 h-8 text-emerald-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Financial Dashboard</h3>
              <p className="text-sm text-gray-600">
                4 accounts (checking, savings, credit cards), 50+ transactions across 90 days, budget categories with spending charts, and a consulting brand with P&L tracking.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Car className="w-8 h-8 text-amber-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Travel & Vehicles</h3>
              <p className="text-sm text-gray-600">
                2 vehicles (Honda CR-V + Trek bike), 12 fuel logs with MPG trends, a road trip from SF to Vegas, and bike fitness rides with savings calculations.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Target className="w-8 h-8 text-blue-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Planner & Roadmap</h3>
              <p className="text-sm text-gray-600">
                Goals, milestones, and daily tasks with week/3-day/daily views. See how the roadmap hierarchy keeps long-term objectives connected to daily action.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Brain className="w-8 h-8 text-indigo-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Focus Engine</h3>
              <p className="text-sm text-gray-600">
                Timer-driven focus sessions with debrief and pain logging. Track deep work streaks and see session analytics over time.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Heart className="w-8 h-8 text-rose-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Health Metrics</h3>
              <p className="text-sm text-gray-600">
                Resting heart rate, steps, sleep, and activity tracking. Sync from Garmin, Oura, or WHOOP — or log manually. View trends and correlations.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Dumbbell className="w-8 h-8 text-fuchsia-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Workouts & Nomad OS</h3>
              <p className="text-sm text-gray-600">
                Full exercise library with RPE, tempo, and supersets. Nomad Longevity OS protocol with AM priming, PM recovery, hotel and gym workouts.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Package className="w-8 h-8 text-teal-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Equipment Tracker</h3>
              <p className="text-sm text-gray-600">
                Track gear, assets, and equipment with purchase costs, current valuations, and category management. Link items to finance transactions.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Users className="w-8 h-8 text-violet-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Saved Contacts</h3>
              <p className="text-sm text-gray-600">
                8 pre-populated vendors and customers. Selecting a saved contact auto-fills transaction categories — see how the autocomplete workflow saves time.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Wrench className="w-8 h-8 text-orange-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Vehicle Maintenance</h3>
              <p className="text-sm text-gray-600">
                5 service records with mileage-based reminders. Oil changes, tire rotations, inspections — all linked to the finance module for cost tracking.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Camera className="w-8 h-8 text-yellow-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Universal Scanner</h3>
              <p className="text-sm text-gray-600">
                OCR-powered receipt and label scanning. Snap a photo to extract data for fuel logs, transactions, nutrition labels, and more.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Tag className="w-8 h-8 text-purple-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Life Categories</h3>
              <p className="text-sm text-gray-600">
                Tag any activity across all modules with life-area labels (Health, Career, Finance, etc.). View analytics and find uncategorized items.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <Database className="w-8 h-8 text-sky-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Data Hub</h3>
              <p className="text-sm text-gray-600">
                Bulk import and export data across 10+ modules with CSV templates and Google Sheets support. Migrate or back up your entire system.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <TrendingUp className="w-8 h-8 text-lime-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Correlations & Analytics</h3>
              <p className="text-sm text-gray-600">
                Cross-module correlation engine — discover how sleep affects productivity, how exercise impacts mood, and more with AI-powered insights.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <History className="w-8 h-8 text-slate-600 mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Life Retrospective</h3>
              <p className="text-sm text-gray-600">
                AI-synthesized life review with Google Calendar import. Reflect on patterns, milestones, and growth across all your tracked data.
              </p>
            </div>
          </div>
        </section>

        {/* Learn the Platform */}
        <section className="mb-12">
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <BookOpen className="w-8 h-8 text-violet-600 shrink-0 mt-1" />
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                  Learn with the Academy
                </h2>
                <p className="text-gray-600 mb-4">
                  CentenarianOS includes 16 tutorial course series covering every module — Getting Started, Travel, Fuel, Finance, Planner, Engine, Health Metrics, Equipment, Data Hub, Categories, Coach, Correlations, Academy, Teaching, Settings, and Workouts. All tutorial lessons are free with Choose Your Own Adventure navigation. Teachers can build courses with the Bulk Course Importer.
                </p>
                <Link
                  href="/academy"
                  className="inline-flex items-center px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-sm"
                >
                  Browse Academy Courses
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Ready for Your Own Account? */}
        <section className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
            Ready for Your Own Account?
          </h2>
          <p className="text-gray-600 mb-6 max-w-lg mx-auto">
            Monthly ($10/mo) or Lifetime ($100 one-time) — both include every module, all future features, and full Academy access.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center px-6 py-3 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-semibold"
          >
            View Plans & Get Started
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>
      </main>

      <SiteFooter theme="light" />
    </div>
  );
}
