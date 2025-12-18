// File: app/page.tsx
import Link from 'next/link';
import { ArrowRight, Target, Utensils, Brain, TrendingUp, Zap, Shield } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-fuchsia-500 to-sky-500 rounded-lg"></div>
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold text-gray-900">CentenarianOS</span>
            </Link>
          </div>
          <div className="flex items-center space-x-6">
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
        </nav>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 mb-6">
            Turn <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-sky-600">Multi-Decade Goals</span> Into Daily Action
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            The personal operating system for executing audacious, long-term goals through data-driven daily habits. Plan, fuel, track, and iterate—all offline-first.
          </p>
          <div className="flex justify-center space-x-4">
            <Link 
              href="/signup" 
              className="px-8 py-4 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-semibold text-lg flex items-center"
            >
              Start Your Journey
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link 
              href="/tech-roadmap" 
              className="px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-semibold text-lg"
            >
              View Tech Roadmap
            </Link>
          </div>
        </div>
      </section>

      {/* Core Modules */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Three Integrated Modules
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Planner */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-t-4 border-fuchsia-500">
            <Target className="w-12 h-12 text-fuchsia-600 mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">The Planner</h3>
            <p className="text-gray-600 mb-4">
              Hierarchical goal tracking from multi-decade roadmaps down to daily tasks. Connect every action to your long-term vision.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-fuchsia-600 mr-2">✓</span>
                Roadmap → Goals → Milestones → Tasks
              </li>
              <li className="flex items-start">
                <span className="text-fuchsia-600 mr-2">✓</span>
                Week/3-day/daily views
              </li>
              <li className="flex items-start">
                <span className="text-fuchsia-600 mr-2">✓</span>
                Real-time progress tracking
              </li>
            </ul>
          </div>

          {/* Fuel */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-t-4 border-sky-500">
            <Utensils className="w-12 h-12 text-sky-600 mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">The Fuel</h3>
            <p className="text-gray-600 mb-4">
              Nutrition tracking with the NCV framework. Optimize your fuel for performance and longevity.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-sky-600 mr-2">✓</span>
                Ingredient library with cost tracking
              </li>
              <li className="flex items-start">
                <span className="text-sky-600 mr-2">✓</span>
                Protocol-based meal logging
              </li>
              <li className="flex items-start">
                <span className="text-sky-600 mr-2">✓</span>
                Auto inventory management
              </li>
            </ul>
          </div>

          {/* Engine */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-t-4 border-lime-500">
            <Brain className="w-12 h-12 text-lime-600 mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">The Engine</h3>
            <p className="text-gray-600 mb-4">
              Focus tracking and AI-assisted debrief system. Generate insights from your daily data.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-lime-600 mr-2">✓</span>
                Focus timer linked to tasks
              </li>
              <li className="flex items-start">
                <span className="text-lime-600 mr-2">✓</span>
                Daily energy/focus ratings
              </li>
              <li className="flex items-start">
                <span className="text-lime-600 mr-2">✓</span>
                Weekly AI-powered reviews
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why CentenarianOS?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="flex items-start space-x-4">
              <Zap className="w-8 h-8 text-fuchsia-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Offline-First</h3>
                <p className="text-gray-600 text-sm">
                  Works without internet. Syncs automatically when connected.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <Shield className="w-8 h-8 text-fuchsia-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Privacy-First</h3>
                <p className="text-gray-600 text-sm">
                  Your data encrypted at rest and in transit. No third-party sharing.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <TrendingUp className="w-8 h-8 text-fuchsia-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Data-Driven</h3>
                <p className="text-gray-600 text-sm">
                  Find correlations between habits and outcomes. Make informed adjustments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-fuchsia-600 to-sky-600 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start Your Centenarian Journey Today
          </h2>
          <p className="text-white/90 mb-8 text-lg max-w-2xl mx-auto">
            Join the beta and help shape the future of long-term goal execution.
          </p>
          <Link 
            href="/signup" 
            className="inline-flex items-center px-8 py-4 bg-white text-fuchsia-600 rounded-lg hover:bg-gray-100 transition-colors font-bold text-lg"
          >
            Create Free Account
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <p className="text-gray-600 text-sm">
              © 2025 CentenarianOS. Open source under MIT License.
            </p>
            <div className="flex space-x-6">
              <Link href="/tech-roadmap" className="text-gray-600 hover:text-gray-900 text-sm">
                Tech Roadmap
              </Link>
              <Link href="/contribute" className="text-gray-600 hover:text-gray-900 text-sm">
                Contribute
              </Link>
              <a 
                href="https://github.com/dapperAuteur/centenarian-os" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 text-sm"
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