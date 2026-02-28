import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Circle, Clock } from 'lucide-react';

const PHASES = [
  {
    id: 1,
    title: 'Phase 1: Core Infrastructure',
    status: 'completed' as const,
    quarter: 'Q4 2025',
    description: 'Foundation — auth, planning, subscriptions, and admin.',
    items: [
      { done: true, text: 'Database schema with RLS policies' },
      { done: true, text: 'Roadmap → Goal → Milestone → Task hierarchy' },
      { done: true, text: 'Real-time task updates via Supabase subscriptions' },
      { done: true, text: 'Financial tracking across planning entities' },
      { done: true, text: 'Stripe member subscriptions (monthly, annual, lifetime)' },
      { done: true, text: 'Admin dashboard with user management and analytics' },
      { done: true, text: 'Cloudflare Turnstile bot prevention on signup' },
      { done: true, text: 'Paid-only signup flow — new accounts redirect to /pricing after registration' },
    ],
  },
  {
    id: 2,
    title: 'Phase 2: Nutrition & Recipes (Fuel Module)',
    status: 'completed' as const,
    quarter: 'Q1 2026',
    description: 'Track what fuels your journey — ingredients, meals, recipes.',
    items: [
      { done: true, text: 'Ingredient library with NCV (Nutrient Cost Value) framework' },
      { done: true, text: 'Protocol-based meal logging system' },
      { done: true, text: 'Cost tracking and budget alerts' },
      { done: true, text: 'USDA FoodData Central API integration' },
      { done: true, text: 'Open Food Facts API integration' },
      { done: true, text: 'Auto inventory management' },
      { done: true, text: 'Public recipe pages with likes, saves, and sharing' },
      { done: true, text: 'Recipe import from any URL (JSON-LD scraping)' },
      { done: true, text: 'Public cook/author profile pages' },
    ],
  },
  {
    id: 3,
    title: 'Phase 3: Publishing Platform (Blog & Community)',
    status: 'completed' as const,
    quarter: 'Q1 2026',
    description: 'A full content publishing system for the CentenarianOS community.',
    items: [
      { done: true, text: 'Blog system with rich text editor and Cloudinary media upload' },
      { done: true, text: 'Public blog pages with likes, saves, and reading progress events' },
      { done: true, text: 'Share bars — Copy Link, Email, LinkedIn, Facebook' },
      { done: true, text: 'Public author profile pages' },
      { done: true, text: 'In-app AI help assistant with RAG (retrieval-augmented generation)' },
      { done: true, text: 'Terms of Use, Privacy Policy, and Safety / Medical Disclaimer pages' },
      { done: true, text: 'Rise Wellness of Indiana mental health resources page' },
      { done: true, text: 'Site footer with legal links on all public pages' },
      { done: true, text: 'Signup Terms + Privacy agreement checkbox' },
    ],
  },
  {
    id: 4,
    title: 'Phase 4: Centenarian Academy (LMS)',
    status: 'in-progress' as const,
    quarter: 'Q1–Q2 2026',
    description: 'A full learning management system — create, publish, sell, and take courses.',
    items: [
      { done: true, text: 'Teacher role and Stripe subscription for teachers' },
      { done: true, text: 'Stripe Connect Express onboarding for teacher payouts' },
      { done: true, text: 'Platform teacher bypass — admin courses pay directly to platform account' },
      { done: true, text: 'Course builder: modules, lessons (video / text / audio / slides), free preview' },
      { done: true, text: 'Course catalog with search, filters, and course detail pages' },
      { done: true, text: 'Student enrollment — free courses and paid (Stripe checkout)' },
      { done: true, text: 'Lesson progress tracking' },
      { done: true, text: 'Choose Your Own Adventure (CYOA) navigation mode per course' },
      { done: true, text: 'Assignment creation, student submission with file upload, teacher grading' },
      { done: true, text: 'Teacher dashboard — course editor, assignment manager, student list' },
      { done: true, text: 'Public teacher pages — browse any teacher\'s published courses' },
      { done: true, text: 'Course likes and saves' },
      { done: true, text: 'Learning paths — sequence courses to show subject proficiency' },
      { done: true, text: 'User achievements and in-app badge shelf' },
      { done: true, text: 'Public progress profiles (/profiles/[username])' },
      { done: true, text: 'Completion certificates (/certificates/[achievementId])' },
      { done: true, text: 'OG social share cards for public profiles' },
      { done: true, text: 'Health metrics daily log — resting HR, steps, sleep, activity minutes' },
      { done: true, text: 'Body weight metric — locked by default, unlock via disclaimer acknowledgment' },
      { done: true, text: 'Admin metrics configuration page' },
      { done: true, text: 'Live sessions — schedule, embed Viloud.tv stream, student access' },
      { done: true, text: 'CYOA crossroads engine — Gemini embeddings + semantic neighbor navigation' },
      { done: true, text: 'Audio/video chapter markers with transcript sync' },
      { done: true, text: 'Interactive map viewer — markers, polygons, line routes per lesson' },
      { done: true, text: 'Document viewer — PDF and image galleries with annotations' },
      { done: true, text: 'Podcast links — multi-platform JSONB (Spotify, Apple, YouTube)' },
      { done: true, text: 'Quiz lesson type with explanations and APA citations' },
      { done: true, text: 'Threaded lesson discussions' },
      { done: true, text: 'Sequential module locking — prerequisite enforcement' },
      { done: true, text: 'Bulk Course Importer — CSV/Google Sheets to create modules + lessons in one operation' },
      { done: true, text: 'Tutorial course series — Travel module (13 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Fuel & Nutrition module (13 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Planner module (14 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Engine module (10 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Health Metrics module (8 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Finance module (10 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Coach & Gems module (8 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Correlations & Analytics module (7 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Academy student guide (14 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Teaching dashboard guide (16 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Settings & Billing guide (4 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Equipment Tracker guide (8 lessons, CYOA navigation)' },
      { done: true, text: 'Tutorial course series — Getting Started guide (6 lessons, CYOA navigation)' },
      { done: true, text: 'Free preview lessons — visitor access without account required' },
      { done: false, text: 'Threaded chat on assignment submissions (student ↔ teacher)' },
      { done: false, text: 'Course direct messages (student ↔ teacher inbox)' },
      { done: false, text: 'Teacher promo codes (Stripe Coupons API)' },
      { done: false, text: 'Free trial periods for subscription courses' },
      { done: false, text: 'Course reviews and star ratings' },
      { done: false, text: 'Progressive metric slots per course attempt (attempt 1 = 1 metric, attempt 2 = 2, etc.)' },
      { done: false, text: 'Re-enrollment flow ("Take Again") for completed courses' },
      { done: false, text: 'AI-recommended learning paths for students (Gemini personalization)' },
      { done: false, text: 'AI path suggestions for teachers (Gemini drafts path groupings from their courses)' },
    ],
  },
  {
    id: 5,
    title: 'Phase 5: Travel & Vehicle Tracking',
    status: 'completed' as const,
    quarter: 'Q1–Q2 2026',
    description: 'Track every mile, every fill-up, and the real cost of getting around. Quantify bike savings against your personal car cost.',
    items: [
      { done: true, text: 'Vehicle profile management (make, model, year, fuel type, odometer baseline)' },
      { done: true, text: 'Fuel log with Trip A/B odometer tracking and automatic MPG calculation' },
      { done: true, text: 'Gemini Vision receipt OCR — extract fill-up data from up to 4 photos' },
      { done: true, text: 'Garmin activity CSV import — cycling, walking, running, hiking → trips' },
      { done: true, text: 'Trip log — manual entry with mode (car/bike/walk/run/ferry/plane/etc.)' },
      { done: true, text: 'Bike savings calculation — bike miles × personal car cost-per-mile' },
      { done: true, text: 'Vehicle maintenance tracker — service records, upcoming reminders' },
      { done: true, text: 'Travel module dashboard — live MPG trend, savings summary, fuel spend' },
      { done: true, text: 'Vehicle ownership types — owned / rental / borrowed (rentals excluded from savings)' },
      { done: true, text: 'Vehicle retirement and reactivation — preserve history without data loss' },
      { done: true, text: 'Trip tax tagging — personal / business / medical / charitable (IRS mileage log)' },
      { done: true, text: 'Travel vs. fitness classification — only travel trips count toward bike savings' },
      { done: true, text: 'Multi-stop trip routes with per-leg cost tracking' },
      { done: true, text: 'Trip templates and multi-stop template blueprints' },
      { done: true, text: 'Round-trip support — one-way distance with ×2 CO2/summary calc' },
      { done: true, text: 'Contact locations — sub-locations for trip origins/destinations' },
    ],
  },
  {
    id: 6,
    title: 'Phase 6: Focus Engine & AI Insights',
    status: 'in-progress' as const,
    quarter: 'Q2 2026',
    description: 'Turn daily data into actionable intelligence — focus, energy, and correlations.',
    items: [
      { done: true, text: 'Pomodoro / focus timer linked to tasks' },
      { done: true, text: 'Daily energy and focus rating system' },
      { done: true, text: 'Pain tracking and body check logging' },
      { done: true, text: 'AI-assisted weekly review generation (Gemini summarization)' },
      { done: true, text: 'Recipe ideas generated from current ingredient inventory (Gemini)' },
      { done: false, text: 'Correlation analysis — nutrition intake ↔ focus/energy performance' },
      { done: true, text: 'Offline-first architecture with IndexedDB sync' },
    ],
  },
  {
    id: 7,
    title: 'Phase 7: Demo Accounts & Onboarding',
    status: 'completed' as const,
    quarter: 'Q1 2026',
    description: 'Public demo accounts and guided onboarding to showcase the full platform.',
    items: [
      { done: true, text: 'Demo account infrastructure — automated setup and daily data reset via cron' },
      { done: true, text: 'Visitor demo account with rich seeded data (finance, travel, fuel, brands)' },
      { done: true, text: 'Tutorial recording account with clean, intentional seed data' },
      { done: true, text: 'Public demo login page — one-click access, no signup needed' },
      { done: true, text: 'Saved contacts system — vendor/customer/location directory' },
      { done: true, text: 'Contact autocomplete with default category auto-fill' },
    ],
  },
  {
    id: 8,
    title: 'Phase 8: Link Tracking & Marketing Analytics',
    status: 'planned' as const,
    quarter: 'Q2–Q3 2026',
    description: 'Auto-generate tracked short links via Switchy.io so every share is measured.',
    items: [
      { done: false, text: 'Switchy.io API integration — auto-create short link on every publish' },
      { done: false, text: 'Custom domain short links (i.centenarianos.com/[slug])' },
      { done: false, text: 'Share bars use Switchy short links (blog, recipes, courses)' },
      { done: false, text: 'OG metadata (title, description, image) synced to Switchy on edit' },
      { done: false, text: 'Admin backfill page — create short links for all existing content' },
    ],
  },
  {
    id: 9,
    title: 'Phase 9: Biometrics & Recovery',
    status: 'in-progress' as const,
    quarter: 'Q1–Q2 2026',
    description: 'Integrate wearable data to close the loop between effort and recovery.',
    items: [
      { done: true, text: 'Health metrics daily log — resting HR, steps, sleep hours, activity minutes' },
      { done: true, text: 'Body weight tracking — locked by default, unlock via disclaimer acknowledgment' },
      { done: true, text: 'Wearable integration — Oura Ring OAuth (sleep, HRV, readiness)' },
      { done: true, text: 'Wearable integration — WHOOP OAuth (strain, recovery, sleep)' },
      { done: true, text: 'Wearable integration — Garmin OAuth (daily auto-sync)' },
      { done: true, text: 'CSV import — Apple Health, Google Health, InBody, Hume Health' },
      { done: true, text: 'Admin metrics configuration page' },
      { done: true, text: '3-tier metrics — Core (RHR/steps/sleep/activity), Enrichment (per-metric unlock), Body Composition' },
      { done: false, text: 'HRV and recovery score tracking' },
      { done: false, text: 'Sleep quality deep-dive (stages, consistency, debt)' },
      { done: false, text: 'Recovery vs. performance correlation dashboard' },
    ],
  },
  {
    id: 10,
    title: 'Phase 10: Financial Dashboard',
    status: 'completed' as const,
    quarter: 'Q1 2026',
    description: 'Full financial tracking — accounts, transactions, budgets, brands, and CSV workflows.',
    items: [
      { done: true, text: 'Financial accounts — checking, savings, credit card, loan, cash' },
      { done: true, text: 'Transaction tracking with vendor, category, and account assignment' },
      { done: true, text: 'Budget categories with monthly limits and color-coded progress' },
      { done: true, text: 'Brand / business P&L — track income and expenses per brand' },
      { done: true, text: 'Bulk CSV import and full data CSV export' },
      { done: true, text: 'Saved contacts — vendor/customer directory with auto-fill' },
      { done: true, text: 'Account balance tracking — opening balance + transaction history' },
      { done: true, text: 'Account deactivation — soft-delete preserves transaction history' },
      { done: true, text: 'Contact locations — sub-locations per vendor/customer' },
    ],
  },
  {
    id: 11,
    title: 'Phase 11: Equipment & Asset Tracking',
    status: 'completed' as const,
    quarter: 'Q1 2026',
    description: 'Track tools, gear, and possessions — purchase price, current value, and cross-module links.',
    items: [
      { done: true, text: 'Equipment categories with auto-seeding on first access' },
      { done: true, text: 'Equipment CRUD — name, category, purchase date, purchase price, notes' },
      { done: true, text: 'Transaction linking — attribute equipment to existing financial transactions' },
      { done: true, text: 'Valuation history — timestamped value snapshots with chart visualization' },
      { done: true, text: 'Equipment summary dashboard — total value, category breakdown' },
      { done: true, text: 'Activity links — cross-link equipment to trips, workouts, maintenance, etc.' },
    ],
  },
  {
    id: 12,
    title: 'Phase 12: Cross-Module Connections',
    status: 'completed' as const,
    quarter: 'Q1 2026',
    description: 'Link data across every module — activities, contacts, and locations.',
    items: [
      { done: true, text: 'Activity links — bidirectional cross-module linking (task↔trip, transaction↔equipment, etc.)' },
      { done: true, text: 'Saved contacts system — vendor/customer/location directory with use-count ranking' },
      { done: true, text: 'Contact locations — multiple sub-locations per contact with default selection' },
      { done: true, text: 'Contact autocomplete with default category auto-fill' },
      { done: true, text: 'Task contacts and locations — assign vendors/places to planner tasks' },
      { done: true, text: 'ActivityLinker UI component — search + pill interface for any module' },
    ],
  },
];

const STATUS_CONFIG = {
  completed: {
    border: 'border-lime-500',
    dot: 'bg-lime-500',
    badge: 'bg-lime-100 text-lime-800',
    label: 'Completed',
    icon: CheckCircle2,
    checkColor: 'text-lime-600',
  },
  'in-progress': {
    border: 'border-fuchsia-500',
    dot: 'bg-fuchsia-500',
    badge: 'bg-fuchsia-100 text-fuchsia-800',
    label: 'In Progress',
    icon: Clock,
    checkColor: 'text-fuchsia-500',
  },
  planned: {
    border: 'border-gray-300',
    dot: 'bg-gray-300',
    badge: 'bg-gray-100 text-gray-700',
    label: 'Planned',
    icon: Circle,
    checkColor: 'text-gray-400',
  },
};

export default function RoadmapPage() {
  const completed = PHASES.filter((p) => p.status === 'completed').length;
  const inProgress = PHASES.filter((p) => p.status === 'in-progress').length;
  const planned = PHASES.filter((p) => p.status === 'planned').length;

  const totalItems = PHASES.flatMap((p) => p.items).length;
  const doneItems = PHASES.flatMap((p) => p.items).filter((i) => i.done).length;
  const pct = Math.round((doneItems / totalItems) * 100);

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
            <div className="w-8 h-8 bg-linear-to-br from-fuchsia-500 to-sky-500 rounded-lg" />
            <Link href="/dashboard/roadmap">
              <span className="text-xl font-bold text-gray-900">CentenarianOS</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-3">
          Product Roadmap
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          Our journey from MVP to a comprehensive personal longevity operating system.
        </p>
        <p className="text-sm text-gray-400 mb-8">Updated February 2026</p>

        {/* Overall progress bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Overall Progress</p>
              <p className="text-3xl font-extrabold text-gray-900">{pct}%</p>
            </div>
            <div className="flex gap-6 text-sm text-right">
              <div>
                <p className="font-bold text-lime-600 text-lg">{completed}</p>
                <p className="text-gray-500">Phases complete</p>
              </div>
              <div>
                <p className="font-bold text-fuchsia-600 text-lg">{inProgress}</p>
                <p className="text-gray-500">In progress</p>
              </div>
              <div>
                <p className="font-bold text-gray-400 text-lg">{planned}</p>
                <p className="text-gray-500">Planned</p>
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-linear-to-r from-fuchsia-500 to-lime-500 h-3 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">{doneItems} of {totalItems} features shipped</p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3">
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
          <Link
            href="/academy"
            className="px-6 py-3 border border-fuchsia-300 text-fuchsia-700 rounded-lg hover:bg-fuchsia-50 transition-colors font-medium"
          >
            Try the Academy
          </Link>
          <Link
            href="/demo"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Try the Demo
          </Link>
        </div>
      </section>

      {/* Phases */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="space-y-8">
          {PHASES.map((phase) => {
            const cfg = STATUS_CONFIG[phase.status];
            const StatusIcon = cfg.icon;
            const phaseTotal = phase.items.length;
            const phaseDone = phase.items.filter((i) => i.done).length;

            return (
              <div key={phase.id} className={`relative pl-8 border-l-4 ${cfg.border}`}>
                <div className={`absolute -left-3 top-0 w-6 h-6 ${cfg.dot} rounded-full flex items-center justify-center`}>
                  <StatusIcon className="w-3.5 h-3.5 text-white" />
                </div>

                <div className="bg-white rounded-xl shadow-md p-6">
                  {/* Phase header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{phase.title}</h2>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold shrink-0 ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">{phase.quarter}</p>
                  <p className="text-gray-600 mb-4">{phase.description}</p>

                  {/* Phase mini progress */}
                  {phase.status !== 'planned' && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{phaseDone}/{phaseTotal} features</span>
                        <span>{Math.round((phaseDone / phaseTotal) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${phase.status === 'completed' ? 'bg-lime-500' : 'bg-fuchsia-500'}`}
                          style={{ width: `${(phaseDone / phaseTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Items */}
                  <ul className="space-y-2">
                    {phase.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        {item.done ? (
                          <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${cfg.checkColor}`} />
                        ) : (
                          <Circle className="w-5 h-5 shrink-0 mt-0.5 text-gray-300" />
                        )}
                        <span className={item.done ? 'text-gray-700' : 'text-gray-500'}>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA footer band */}
      <section className="bg-gray-900 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Help Build the Future</h2>
          <p className="text-gray-400 mb-8 text-lg">
            CentenarianOS is open source. Contribute code, suggest features, or report bugs.
          </p>
          <div className="flex justify-center flex-wrap gap-4">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex justify-between items-center">
          <p className="text-gray-600 text-sm">© 2026 B4C LLC / AwesomeWebStore.com. MIT License.</p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/academy" className="text-gray-600 hover:text-gray-900">Academy</Link>
            <Link href="/blog" className="text-gray-600 hover:text-gray-900">Blog</Link>
            <Link href="/recipes" className="text-gray-600 hover:text-gray-900">Recipes</Link>
            <Link href="/" className="text-gray-600 hover:text-gray-900">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
