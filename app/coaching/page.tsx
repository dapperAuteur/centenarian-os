'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import SiteFooter from '@/components/ui/SiteFooter';

const PRIORITIES = [
  { id: 'cardiovascular', label: 'Cardiovascular Health', description: 'Heart health, VO₂ max, endurance baseline' },
  { id: 'body_composition', label: 'Body Composition', description: 'Fat loss, muscle retention, metabolic health' },
  { id: 'sleep', label: 'Sleep Quality', description: 'Sleep architecture, recovery optimization' },
  { id: 'stress_recovery', label: 'Stress & Recovery', description: 'HRV, nervous system regulation, burnout prevention' },
  { id: 'nutrition', label: 'Nutrition Protocols', description: 'Evidence-based eating patterns for longevity' },
  { id: 'cognitive', label: 'Cognitive Performance', description: 'Focus, mental clarity, brain health long-term' },
  { id: 'longevity', label: 'Longevity Planning', description: 'Healthspan strategy, biomarkers, 10-year trajectory' },
];

const TIERS = [
  {
    name: 'Foundation',
    tagline: 'For high performers building their health baseline',
    includes: [
      'Initial 90-minute longevity assessment',
      'Personalized health & nutrition protocol',
      'Monthly 1:1 coaching sessions',
      'Ongoing protocol adjustments',
      'Access to CentenarianOS platform',
    ],
  },
  {
    name: 'Accelerator',
    tagline: 'For those with specific targets and tight timelines',
    includes: [
      'Everything in Foundation',
      'Bi-weekly 1:1 sessions',
      'Weekly check-ins via messaging',
      'Movement assessment & corrective plan',
      'Quarterly biomarker review',
    ],
  },
  {
    name: 'Executive',
    tagline: 'For leaders who need a full-spectrum partner',
    includes: [
      'Everything in Accelerator',
      'Weekly 1:1 sessions',
      'On-demand messaging access',
      'Travel & schedule-resilient protocols',
      'Family health planning consultation',
      'Priority scheduling & response time',
    ],
  },
];

export default function CoachingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [formData, setFormData] = useState({ name: '', email: '', role: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [openTier, setOpenTier] = useState<number | null>(null);

  function togglePriority(id: string) {
    setSelectedPriorities(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedPriorities.length) {
      setError('Please select at least one priority area.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, priorities: selectedPriorities }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-linear-to-br from-fuchsia-500 to-sky-500 rounded-lg shrink-0" />
              <span className="text-lg sm:text-xl font-bold text-gray-900">CentenarianOS</span>
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              <Link href="/demo" className="text-gray-600 hover:text-gray-900 font-medium">Demo</Link>
              <Link href="/academy" className="text-gray-600 hover:text-gray-900 font-medium">Academy</Link>
              <Link href="/blog" className="text-gray-600 hover:text-gray-900 font-medium">Blog</Link>
              <Link href="/recipes" className="text-gray-600 hover:text-gray-900 font-medium">Recipes</Link>
              <Link href="/coaching" className="text-fuchsia-700 font-semibold">Coaching</Link>
              <Link href="/tech-roadmap" className="text-gray-600 hover:text-gray-900 font-medium">Tech Roadmap</Link>
              <Link href="/contribute" className="text-gray-600 hover:text-gray-900 font-medium">Contribute</Link>
              <Link
                href="/pricing"
                className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              aria-label="Toggle menu"
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
              <Link href="/coaching" className="block text-fuchsia-700 font-semibold" onClick={() => setMobileMenuOpen(false)}>Coaching</Link>
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

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700 text-sm font-medium mb-6">
          CentenarianOS Coaching
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
          Live longer.<br />
          <span className="text-transparent bg-clip-text bg-linear-to-r from-fuchsia-600 to-sky-500">
            Perform better.
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
          Longevity coaching for executives, founders, and creative professionals who want to build a body and mind that compounds over decades, not just survives the week.
        </p>
        <a
          href="#apply"
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-fuchsia-600 text-white font-semibold rounded-xl hover:bg-fuchsia-700 transition-colors text-base sm:text-lg"
        >
          Apply to Work Together
        </a>
      </section>

      {/* Who it's for */}
      <section className="border-t border-gray-100 bg-white py-14 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">Who this is for</h2>
          <p className="text-gray-500 text-center mb-10 max-w-xl mx-auto">
            High-output people who have optimized their career but haven&apos;t applied the same rigor to their health.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { title: 'Executives & Operators', body: 'You lead organizations. Your energy, clarity, and physical resilience are core business assets. You need a protocol that works around your schedule, not despite it.' },
              { title: 'Founders & Business Owners', body: 'You can\'t afford sick days, burnout, or declining cognitive performance. You need a system that builds durable health without requiring you to become a full-time athlete.' },
              { title: 'Artists & Creative Professionals', body: 'Your work demands sustained creative energy, long sessions, and mental endurance. Your physical state directly shapes your output and your longevity in your field.' },
            ].map(({ title, body }) => (
              <div key={title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="py-14 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">Built differently</h2>
          <p className="text-gray-500 text-center mb-10 max-w-xl mx-auto">
            Four credentials that work together as a single integrated system, not four separate specialists.
          </p>
          <div className="grid sm:grid-cols-2 gap-5 mb-10">
            {[
              {
                abbr: 'MBA',
                full: 'Master of Business Administration, Supply Chain Management',
                what: 'Graduate-level training in systems optimization, analytical frameworks, and operations management.',
                how: 'The human body is a complex system with interdependencies, feedback loops, and optimization constraints. This credential brings rigorous systems thinking from supply chain management to health coaching: identifying bottlenecks, sequencing interventions, and measuring what matters.',
              },
              {
                abbr: 'CPT',
                full: 'Certified Personal Trainer',
                what: 'Evidence-based exercise programming, movement principles, and training periodization.',
                how: 'Designs training protocols that build cardiovascular fitness, muscular strength, and movement quality. Each protocol is calibrated to your current capacity, schedule, and goals. Not generic workouts: periodized programming with clear progression.',
              },
              {
                abbr: 'CNC',
                full: 'Certified Nutrition Coach',
                what: 'Precision nutrition coaching grounded in current research on longevity, metabolic health, and performance.',
                how: 'Translates nutrition science into practical protocols: what to eat, when, and why. Each protocol is adjusted for your physiology, lifestyle, and travel demands. Eliminates guesswork and diet cycling in favor of sustainable, evidence-based eating patterns.',
              },
              {
                abbr: 'CES',
                full: 'Corrective Exercise Specialist',
                what: 'Assessment and correction of movement dysfunctions, muscular imbalances, and injury risk patterns.',
                how: 'Desk work, high-volume travel, and years of training without corrective work create compensations that limit performance and accelerate wear. CES identifies and addresses these patterns before they become chronic injuries, protecting your ability to train for decades.',
              },
            ].map(({ abbr, full, what, how }) => (
              <div key={abbr} className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex items-start gap-3 mb-3">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-fuchsia-50 text-fuchsia-700 font-bold text-sm shrink-0">
                    {abbr}
                  </span>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{full}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{what}</div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">{how}</p>
              </div>
            ))}
          </div>

          {/* Synergy paragraph */}
          <div className="bg-linear-to-r from-fuchsia-50 to-sky-50 border border-fuchsia-100 rounded-2xl p-6 sm:p-8">
            <h3 className="font-semibold text-gray-900 mb-2 text-base sm:text-lg">Why these four credentials together</h3>
            <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
              Most people work with a personal trainer, a separate nutritionist, and maybe a physical therapist: three conversations, three protocols, no integration. An MBA in Supply Chain Management means every intervention is designed as part of a system. Training load, nutritional timing, movement quality, and recovery capacity are modeled together and adjusted as a unit. The CES credential identifies where compensation patterns would eventually derail the training plan. The CNC credential ensures the nutritional substrate supports the training stimulus. The result is a coaching engagement where exercise, nutrition, movement quality, and recovery are one integrated protocol, not four separate opinions.
            </p>
          </div>
        </div>
      </section>

      {/* Focus Areas */}
      <section className="border-t border-gray-100 bg-white py-14 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">What we work on</h2>
          <p className="text-gray-500 text-center mb-10 max-w-xl mx-auto">
            Every engagement is built around your specific priorities. These are the domains we address.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {PRIORITIES.map(({ label, description }) => (
              <div key={label} className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                <CheckCircle className="w-5 h-5 text-fuchsia-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-900 text-sm">{label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-14 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">Engagement formats</h2>
          <p className="text-gray-500 text-center mb-10 max-w-xl mx-auto">
            Three tiers of engagement. Discuss which fits your goals and schedule during your application call.
          </p>
          <div className="space-y-3">
            {TIERS.map((tier, i) => (
              <div key={tier.name} className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
                <button
                  onClick={() => setOpenTier(openTier === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <span className="font-semibold text-gray-900">{tier.name}</span>
                    <span className="text-gray-500 text-sm ml-3">{tier.tagline}</span>
                  </div>
                  {openTier === i ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                </button>
                {openTier === i && (
                  <div className="px-6 pb-5 border-t border-gray-100">
                    <ul className="mt-4 space-y-2">
                      {tier.includes.map(item => (
                        <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-fuchsia-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-6">
            Pricing is discussed directly. No public rate cards; every engagement is scoped to fit.
          </p>
        </div>
      </section>

      {/* Application Form */}
      <section id="apply" className="border-t border-gray-100 bg-white py-14 sm:py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">Apply to work together</h2>
          <p className="text-gray-500 text-center mb-10 max-w-md mx-auto text-sm sm:text-base">
            Tell me a bit about yourself and what you want to work on. I&apos;ll follow up within 48 hours.
          </p>

          {submitted ? (
            <div className="text-center py-12 px-6 bg-fuchsia-50 border border-fuchsia-100 rounded-2xl">
              <CheckCircle className="w-12 h-12 text-fuchsia-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Application received</h3>
              <p className="text-gray-600 text-sm">
                Thanks for reaching out. I&apos;ll review your application and get back to you within 48 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="jane@company.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Your role / what you do
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                  placeholder="CEO, Founder, Creative Director, etc."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What are your priority areas? *
                  <span className="text-gray-400 font-normal ml-1">(select all that apply)</span>
                </label>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {PRIORITIES.map(({ id, label, description }) => {
                    const selected = selectedPriorities.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => togglePriority(id)}
                        className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                          selected
                            ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-900'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selected ? 'border-fuchsia-500 bg-fuchsia-500' : 'border-gray-300'}`}>
                            {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <span className="font-medium">{label}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 ml-6">{description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tell me about your situation
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <textarea
                  rows={4}
                  value={formData.message}
                  onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                  placeholder="Where are you now, what have you tried, what's the gap you're trying to close?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 bg-fuchsia-600 text-white font-semibold rounded-xl hover:bg-fuchsia-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-base"
              >
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                No spam. Your information is only used to respond to your application.
              </p>
            </form>
          )}
        </div>
      </section>

      <SiteFooter theme="light" />
    </div>
  );
}
