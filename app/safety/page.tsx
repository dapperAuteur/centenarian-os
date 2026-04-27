// app/safety/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Phone, MapPin, Clock, ExternalLink, AlertTriangle, Heart } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/ui/SiteFooter';

export const metadata: Metadata = {
  title: 'Safety & Resources | CentenarianOS',
  description:
    'Health and safety information, medical disclaimers, and mental health resources for CentenarianOS users.',
};

export default function SafetyPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-gray-950 text-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Safety &amp; Resources</h1>
        <p className="text-gray-400 text-sm mb-10">
          Your wellbeing matters. Please read this page before using health tools or course content.
        </p>

        {/* Medical Disclaimer */}
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-yellow-300 mb-2">Medical Disclaimer</h2>
              <p className="text-yellow-100/80 text-sm leading-relaxed">
                CentenarianOS is a <strong>self-tracking and education platform</strong>. It is{' '}
                <strong>NOT a medical service, clinic, or healthcare provider</strong>. All content on
                this platform, including course lessons, AI-generated health insights, blog posts,
                recipes, and metric summaries, is for <strong>informational and educational
                purposes only</strong> and does not constitute medical advice, diagnosis, or treatment.
              </p>
            </div>
          </div>
        </div>

        {/* Consult Your Doctor */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-3">Consult Your Doctor</h2>
          <div className="text-gray-300 text-sm leading-relaxed space-y-3">
            <p>
              <strong className="text-white">
                Always consult a qualified, licensed healthcare provider before making any changes to
                your health regimen
              </strong>
              , including changes to exercise, nutrition, supplements, or medications.
            </p>
            <p>
              Do not disregard or delay professional medical advice based on anything you read, learn,
              or are prompted by on this platform. If you have a pre-existing medical condition, are
              pregnant, or are currently under physician care, consult your provider before using any
              tracking features or following any course recommendations.
            </p>
            <p>
              Wearable device data (from Apple Watch, Fitbit, Garmin, Oura Ring, or similar devices)
              is consumer-grade data. It provides estimates, not clinical measurements.{' '}
              <strong className="text-white">
                Precision is not accuracy. Use device data as a personal baseline, not a diagnostic
                tool.
              </strong>
            </p>
            <p>
              CentenarianOS, B4C LLC, AwesomeWebStore.com, and Anthony McDonald are held harmless for
              any decisions you make based on content, tools, or insights from this platform. See our{' '}
              <Link href="/terms" className="text-fuchsia-400 hover:underline">Terms of Use</Link> for
              full details.
            </p>
          </div>
        </section>

        {/* Mental Health Crisis */}
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-5 mb-10">
          <h2 className="text-base font-semibold text-red-300 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Mental Health Crisis?
          </h2>
          <p className="text-red-100/80 text-sm leading-relaxed">
            If you are experiencing a mental health crisis, thoughts of self-harm, or a psychiatric
            emergency:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-red-100/80">
            <li>
              <strong className="text-white">988 Suicide &amp; Crisis Lifeline</strong>: Call or text{' '}
              <a href="tel:988" className="text-red-300 font-bold hover:underline">988</a> (US)
            </li>
            <li>
              <strong className="text-white">Emergency</strong>: Call{' '}
              <a href="tel:911" className="text-red-300 font-bold hover:underline">911</a> or go to
              your nearest emergency room
            </li>
          </ul>
        </div>

        {/* Rise Wellness */}
        <section id="rise-wellness" className="mb-10 scroll-mt-20">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-fuchsia-400" />
            <h2 className="text-xl font-semibold text-white">Mental Health Support</h2>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-1">Rise Wellness of Indiana</h3>
            <p className="text-fuchsia-300 text-xs font-medium mb-4 uppercase tracking-wide">
              Independent Mental Health Provider · Not affiliated with CentenarianOS
            </p>

            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              Rise Wellness of Indiana provides compassionate, personalized, holistic mental health
              care. Their mission is to support your mental and physical well-being through
              evidence-based medicine, trauma-informed care, and a whole-person approach, helping
              you heal, grow, and thrive in mind, body, and spirit.
            </p>

            {/* Services */}
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-gray-100 mb-2">Services offered:</h4>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-400">
                <li>• ADHD Testing &amp; Management</li>
                <li>• Anxiety &amp; Depression</li>
                <li>• Maternal Mental Health</li>
                <li>• Medication Management</li>
                <li>• GeneSight® Genetic Testing</li>
                <li>• Behavioral Therapy &amp; Coaching</li>
                <li>• Comprehensive ADHD Testing (from home)</li>
                <li>• Routine Lab Testing</li>
              </ul>
            </div>

            {/* Contact info */}
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex items-start gap-2 text-gray-300">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
                <span>320 North Meridian Street, Indianapolis, IN 46204</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Clock className="w-4 h-4 shrink-0 text-gray-500" />
                <span>Monday – Saturday by appointment &nbsp;·&nbsp; Sunday closed</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Phone className="w-4 h-4 shrink-0 text-gray-500" />
                <a
                  href="tel:+13179650299"
                  className="text-fuchsia-400 font-semibold hover:underline"
                >
                  317-965-0299
                </a>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Call button — tel: link opens native dialer on mobile */}
              <a
                href="tel:+13179650299"
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg font-semibold text-sm transition"
              >
                <Phone className="w-4 h-4" />
                Call Rise Wellness
              </a>
              <a
                href="https://risewellnessofindiana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-semibold text-sm transition"
              >
                <ExternalLink className="w-4 h-4" />
                Visit Website
              </a>
            </div>

            {/* Non-affiliation disclaimer */}
            <p className="mt-4 text-xs text-gray-500 leading-relaxed">
              Rise Wellness of Indiana is an independent organization. They are not affiliated with,
              employed by, or endorsed by CentenarianOS, B4C LLC, AwesomeWebStore.com, or Anthony
              McDonald. We are grateful for their collaboration on mental health safety resources for
              our community.
            </p>
          </div>
        </section>

        {/* About Rise Wellness — mission quote */}
        <section className="mb-10">
          <blockquote className="border-l-4 border-fuchsia-600 pl-4 text-gray-400 text-sm italic leading-relaxed">
            &ldquo;At Rise Wellness, we believe everyone has the capacity to rise above challenges
            and live a fulfilling, healthy life. Our care is guided by the belief that healing is
            personal, holistic, and rooted in compassion.&rdquo;
            <br />
            <span className="not-italic text-gray-500 text-xs mt-1 block">Rise Wellness of Indiana</span>
          </blockquote>
        </section>

        </div>
      </main>
      <SiteFooter />
    </>
  );
}
