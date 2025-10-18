// File: app/roadmap/page.tsx
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Circle, Clock } from 'lucide-react';

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-fuchsia-500 to-sky-500 rounded-lg"></div>
            <span className="text-xl font-bold text-gray-900">CentenarianOS</span>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">
          Product Roadmap
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Our journey from MVP to a comprehensive personal operating system. Updated monthly.
        </p>
        <div className="flex space-x-4">
          <a 
            href="https://github.com/dapperAuteur/centenarian-os" 
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            View on GitHub
          </a>
          <Link 
            href="/contribute" 
            className="px-6 py-3 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-medium"
          >
            Contribute
          </Link>
        </div>
      </section>

      {/* Timeline */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-8">
          
          {/* Phase 1 - Completed */}
          <div className="relative pl-8 border-l-4 border-lime-500">
            <div className="absolute -left-3 top-0 w-6 h-6 bg-lime-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-bold text-gray-900">Phase 1: Core Planner Module</h2>
                <span className="px-3 py-1 bg-lime-100 text-lime-800 rounded-full text-sm font-semibold">
                  Completed
                </span>
              </div>
              <p className="text-gray-600 mb-4">
                Q4 2025 • Foundation of the hierarchical goal system
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-lime-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Database schema with RLS policies</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-lime-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Roadmap → Goal → Milestone → Task hierarchy</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-lime-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Real-time task updates via Supabase subscriptions</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-lime-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Offline-first architecture with IndexedDB</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Phase 2 - In Progress */}
          <div className="relative pl-8 border-l-4 border-sky-500">
            <div className="absolute -left-3 top-0 w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-bold text-gray-900">Phase 2: Nutrition Tracking (Fuel Module)</h2>
                <span className="px-3 py-1 bg-sky-100 text-sky-800 rounded-full text-sm font-semibold">
                  In Progress
                </span>
              </div>
              <p className="text-gray-600 mb-4">
                Q1 2026 • Track what fuels your journey
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-sky-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Ingredient library with NCV framework</span>
                </li>
                <li className="flex items-start">
                  <Clock className="w-5 h-5 text-sky-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Protocol-based meal logging system</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Auto inventory management</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Cost tracking and budget alerts</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">USDA API integration for ingredient data</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Phase 3 - Planned */}
          <div className="relative pl-8 border-l-4 border-gray-300">
            <div className="absolute -left-3 top-0 w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
              <Circle className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-bold text-gray-900">Phase 3: Focus Tracking & AI Debrief (Engine)</h2>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                  Planned
                </span>
              </div>
              <p className="text-gray-600 mb-4">
                Q2 2026 • Generate insights from daily data
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Focus timer linked to tasks</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Daily energy/focus rating system</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">AI-assisted weekly review generation</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Correlation analysis (nutrition ↔ performance)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Phase 4 - Future */}
          <div className="relative pl-8 border-l-4 border-gray-300">
            <div className="absolute -left-3 top-0 w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
              <Circle className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-bold text-gray-900">Phase 4: Biometrics & Recovery</h2>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                  Future
                </span>
              </div>
              <p className="text-gray-600 mb-4">
                Q3 2026 • Integrate wearable data
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Wearable device integration (Oura, Whoop, Apple Watch)</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Sleep quality tracking</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">HRV and recovery metrics</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Body composition logging</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Phase 5 - Future */}
          <div className="relative pl-8 border-l-4 border-gray-300">
            <div className="absolute -left-3 top-0 w-6 h-6 bg-gray-300 rounded-full"></div>
            <div className="bg-white rounded-xl shadow-md p-6 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-bold text-gray-900">Phase 5: Financial Dashboard</h2>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                  Future
                </span>
              </div>
              <p className="text-gray-600 mb-4">
                Q4 2026 • Connect spending to goals
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Budget tracking by goal category</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Nutrition cost integration</span>
                </li>
                <li className="flex items-start">
                  <Circle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">ROI visualization per goal</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Help Build the Future
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            CentenarianOS is open source. Contribute code, suggest features, or report bugs.
          </p>
          <div className="flex justify-center space-x-4">
            <a 
              href="https://github.com/dapperAuteur/centenarian-os" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
            >
              View Repository
            </a>
            <Link 
              href="/contribute" 
              className="px-8 py-3 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-semibold"
            >
              Contribution Guide
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <p className="text-gray-600 text-sm">
              © 2025 CentenarianOS. MIT License.
            </p>
            <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm">
              Back to Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}