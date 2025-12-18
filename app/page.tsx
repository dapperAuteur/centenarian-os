'use client';

import Link from 'next/link';
import { ArrowRight, Target, Utensils, Brain, TrendingUp, Zap, Shield, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header - Mobile First */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-fuchsia-500 to-sky-500 rounded-lg flex-shrink-0"></div>
              <span className="text-lg sm:text-xl font-bold text-gray-900">CentenarianOS</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/tech-roadmap" className="text-gray-600 hover:text-gray-900 font-medium">
                Tech Roadmap
              </Link>
              <Link href="/contribute" className="text-gray-600 hover:text-gray-900 font-medium">
                Contribute
              </Link>
              <Link 
                href="/signup" 
                className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-medium"
              >
                Get Started
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
                href="/signup" 
                className="block w-full text-center px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section - Mobile First */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 md:pt-20 pb-8 sm:pb-12 md:pb-16">
        <div className="text-center max-w-3xl mx-auto">
          {/* Mobile: 2xl, Tablet: 4xl, Desktop: 6xl */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-4 sm:mb-6 leading-tight">
            Turn <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-sky-600">Multi-Decade Goals</span> Into Daily Action
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 px-2">
            The personal operating system for executing audacious, long-term goals through data-driven daily habits. Plan, fuel, track, and iterate—all offline-first.
          </p>

          {/* Buttons - Stack on mobile, side-by-side on tablet+ */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4 sm:px-0">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-semibold text-base sm:text-lg flex items-center justify-center"
            >
              Start Your Journey
              <ArrowRight className="ml-2 w-5 h-5" />
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

      {/* Core Modules */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-6 sm:mb-8 md:mb-12">
          Three Integrated Modules
        </h2>
        
        {/* Grid: 1 col mobile, 3 cols tablet+ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Planner */}
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border-t-4 border-fuchsia-500">
            <Target className="w-10 h-10 sm:w-12 sm:h-12 text-fuchsia-600 mb-3 sm:mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">The Planner</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
              Hierarchical goal tracking from multi-decade roadmaps down to daily tasks. Connect every action to your long-term vision.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-fuchsia-600 mr-2 flex-shrink-0">✓</span>
                Roadmap → Goals → Milestones → Tasks
              </li>
              <li className="flex items-start">
                <span className="text-fuchsia-600 mr-2 flex-shrink-0">✓</span>
                Week/3-day/daily views
              </li>
              <li className="flex items-start">
                <span className="text-fuchsia-600 mr-2 flex-shrink-0">✓</span>
                Real-time progress tracking
              </li>
            </ul>
          </div>

          {/* Fuel */}
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border-t-4 border-sky-500">
            <Utensils className="w-10 h-10 sm:w-12 sm:h-12 text-sky-600 mb-3 sm:mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">The Fuel</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
              Nutrition tracking with the NCV framework. Optimize your fuel for performance and longevity.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-sky-600 mr-2 flex-shrink-0">✓</span>
                Ingredient library with cost tracking
              </li>
              <li className="flex items-start">
                <span className="text-sky-600 mr-2 flex-shrink-0">✓</span>
                Green/Yellow/Red scoring
              </li>
              <li className="flex items-start">
                <span className="text-sky-600 mr-2 flex-shrink-0">✓</span>
                Meal prep batch tracking
              </li>
              <li className="flex items-start">
                <span className="text-sky-600 mr-2 flex-shrink-0">✓</span>
                Auto inventory management
              </li>
              <li className="flex items-start">
                <span className="text-sky-600 mr-2 flex-shrink-0">✓</span>
                Restaurant vs home-cooked analytics
              </li>
            </ul>
          </div>

          {/* Engine */}
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border-t-4 border-lime-500">
            <Brain className="w-10 h-10 sm:w-12 sm:h-12 text-lime-600 mb-3 sm:mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">The Engine</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
              Focus tracking, Pomodoro timers, and daily debriefs to maintain momentum.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-lime-600 mr-2 flex-shrink-0">✓</span>
                Pomodoro focus sessions
              </li>
              <li className="flex items-start">
                <span className="text-lime-600 mr-2">✓</span>
                Focus timer linked to tasks
              </li>
              <li className="flex items-start">
                <span className="text-lime-600 mr-2 flex-shrink-0">✓</span>
                Daily energy + win/challenge logs
              </li>
              <li className="flex items-start">
                <span className="text-lime-600 mr-2">✓</span>
                Daily energy/focus ratings
              </li>
              <li className="flex items-start">
                <span className="text-lime-600 mr-2 flex-shrink-0">✓</span>
                Body check & pain tracking
              </li>
              <li className="flex items-start">
                <span className="text-lime-600 mr-2">✓</span>
                Weekly AI-powered reviews
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Why Offline-First */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <div className="bg-gray-100 rounded-2xl p-6 sm:p-8 md:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-6 sm:mb-8">
            Built for Real Life
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="flex items-start space-x-3 sm:space-x-4">
              <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-fuchsia-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1 sm:mb-2 text-base sm:text-lg">Offline-First</h3>
                <p className="text-gray-600 text-sm">
                  Works without internet. Syncs automatically when connected.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 sm:space-x-4">
              <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-fuchsia-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1 sm:mb-2 text-base sm:text-lg">Privacy-First</h3>
                <p className="text-gray-600 text-sm">
                  Your data encrypted at rest and in transit. No third-party sharing.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 sm:space-x-4">
              <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-fuchsia-600 flex-shrink-0" />
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

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <div className="bg-gradient-to-r from-fuchsia-600 to-sky-600 rounded-2xl p-6 sm:p-8 md:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
            Start Your Centenarian Journey Today
          </h2>
          <p className="text-white/90 mb-6 sm:mb-8 text-base sm:text-lg max-w-2xl mx-auto px-2">
            Join the beta and help shape the future of long-term goal execution.
          </p>
          <Link 
            href="/signup" 
            className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-white text-fuchsia-600 rounded-lg hover:bg-gray-100 transition-colors font-bold text-base sm:text-lg"
          >
            Create Free Account
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
            <p className="text-gray-600 text-xs sm:text-sm text-center sm:text-left">
              © 2025 CentenarianOS. Open source under MIT License.
            </p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <Link href="/tech-roadmap" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm">
                Tech Roadmap
              </Link>
              <Link href="/contribute" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm">
                Contribute
              </Link>
              <a 
                href="https://github.com/dapperAuteur/centenarian-os" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}