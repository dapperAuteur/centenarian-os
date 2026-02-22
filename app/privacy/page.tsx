// app/privacy/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | CentenarianOS',
  description: 'Privacy Policy for CentenarianOS, operated by B4C LLC / AwesomeWebStore.com.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-400 text-sm mb-10">
          Last updated: February 21, 2026 &nbsp;·&nbsp; Operated by B4C LLC / AwesomeWebStore.com
        </p>

        <Section title="1. Who We Are">
          <p>
            CentenarianOS ("we," "us," "our") is a longevity and health education platform operated by
            B4C LLC and AwesomeWebStore.com, founded by Anthony McDonald. This Privacy Policy explains
            how we collect, use, store, and protect your personal information.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <h3 className="font-medium text-gray-100 mb-1">Account Information</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Email address</li>
            <li>Display name and username</li>
            <li>Profile photo (optional)</li>
            <li>Billing information (processed by Stripe — we do not store card numbers)</li>
          </ul>

          <h3 className="font-medium text-gray-100 mt-4 mb-1">Health &amp; Metrics Data</h3>
          <p>
            If you choose to use the Metrics features, we collect daily health data you enter manually,
            including: resting heart rate, step count, sleep hours, activity minutes, and optional
            enrichment metrics (HRV, SpO2, sleep score, stress score, recovery score, active calories).
            Body weight tracking requires explicit opt-in acknowledgment.
          </p>
          <p className="mt-2">
            <strong>This data is private by default.</strong> It is never sold. Your public profile
            shows only aggregate summaries (e.g., day-logging streak count), never raw metric values.
          </p>

          <h3 className="font-medium text-gray-100 mt-4 mb-1">Content You Create</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Blog posts, recipes, and recipe ingredients</li>
            <li>Course enrollment and lesson progress</li>
            <li>Assignment submissions and course messages</li>
            <li>Feedback you submit to the platform</li>
          </ul>

          <h3 className="font-medium text-gray-100 mt-4 mb-1">Usage Data</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Blog post and recipe view events (session-based, with referrer and country)</li>
            <li>Share events (copy link, email, social)</li>
            <li>Read depth tracking on blog posts</li>
            <li>Device type and browser (collected by Vercel Analytics)</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-1">
            <li>To operate and improve the Platform</li>
            <li>To personalize your learning experience and generate AI-powered insights</li>
            <li>To process payments and manage subscriptions through Stripe</li>
            <li>To send transactional emails (account creation, billing, course updates)</li>
            <li>To display your public content (blog posts, recipes, public profile)</li>
            <li>To analyze how features are used so we can improve them</li>
          </ul>
          <p className="mt-3">
            We do not sell your personal information to third parties.
          </p>
        </Section>

        <Section title="4. AI-Powered Features">
          <p>
            Some features (the in-app help chat and health metric insights) use Google Gemini, an
            AI service operated by Google. When you use these features:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Your question or anonymized metric data is sent to Google's API</li>
            <li>Your name, email, and account ID are never included in AI prompts</li>
            <li>Google's data handling is governed by the{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-400 hover:underline"
              >
                Google Privacy Policy
              </a>
            </li>
          </ul>
        </Section>

        <Section title="5. Service Providers (Data Processors)">
          <p>We share data with the following trusted service providers only as necessary to operate the Platform:</p>
          <div className="mt-3 space-y-2">
            <Provider name="Supabase" purpose="Database hosting and authentication (PostgreSQL + row-level security)" />
            <Provider name="Stripe" purpose="Payment processing and subscription management" />
            <Provider name="Cloudinary" purpose="Media storage (images and videos you upload)" />
            <Provider name="Google (Gemini API)" purpose="AI-powered insights and help chat" />
            <Provider name="Vercel" purpose="Platform hosting, edge functions, and analytics" />
          </div>
          <p className="mt-3">
            Each provider is contractually bound to protect your data and use it only for the services
            they provide to us.
          </p>
        </Section>

        <Section title="6. Health Data — Special Protections">
          <p>
            Health and biometric data you enter is stored in your private account only. It is:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Protected by row-level security — only you and server-side processes can read it</li>
            <li>Never shared with other users, teachers, or third parties without your consent</li>
            <li>Not used for advertising or profiling</li>
            <li>Accessible to you in full — you can export or delete it at any time</li>
          </ul>
          <p className="mt-3">
            We are not a HIPAA-covered entity. Health data you enter is consumer self-tracking data,
            not clinical health records.
          </p>
        </Section>

        <Section title="7. Cookies and Session Storage">
          <p>
            We use session cookies required for authentication (managed by Supabase Auth). We do not
            use third-party advertising cookies. Vercel Analytics uses anonymized, cookie-free
            analytics that does not track individuals across sites.
          </p>
        </Section>

        <Section title="8. Data Retention">
          <p>
            We retain your account data for as long as your account is active. If you delete your
            account, your personal data (profile, health metrics, and private content) is deleted
            within 30 days. Public content (blog posts, recipes you published) may be retained in
            anonymized form unless you explicitly request full deletion.
          </p>
        </Section>

        <Section title="9. Your Rights">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Access:</strong> Request a copy of the data we hold about you</li>
            <li><strong>Correction:</strong> Update inaccurate or incomplete information</li>
            <li><strong>Deletion:</strong> Request deletion of your account and personal data</li>
            <li><strong>Portability:</strong> Export your health metrics data as CSV</li>
            <li><strong>Opt-out:</strong> Disable optional features (AI insights, metric tracking) at any time</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, email us at{' '}
            <a href="mailto:hello@centenarianos.com" className="text-fuchsia-400 hover:underline">
              hello@centenarianos.com
            </a>
            .
          </p>
        </Section>

        <Section title="10. Children's Privacy">
          <p>
            The Platform is not directed at children under 18. We do not knowingly collect personal
            information from minors. If you believe a minor has created an account, contact us for
            immediate removal.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy periodically. Material changes will be communicated by
            email or by a notice on the Platform. Your continued use after changes take effect
            constitutes acceptance.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            Privacy questions or requests:{' '}
            <a href="mailto:hello@centenarianos.com" className="text-fuchsia-400 hover:underline">
              hello@centenarianos.com
            </a>
            <br />
            B4C LLC / AwesomeWebStore.com — Indianapolis, Indiana, USA
          </p>
        </Section>

        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-4 text-sm text-gray-500">
          <Link href="/terms" className="hover:text-gray-300 transition">Terms of Use</Link>
          <Link href="/safety" className="hover:text-gray-300 transition">Safety & Resources</Link>
          <Link href="/" className="hover:text-gray-300 transition">Home</Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="text-gray-300 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Provider({ name, purpose }: { name: string; purpose: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-100 font-medium w-28 shrink-0">{name}</span>
      <span className="text-gray-400">{purpose}</span>
    </div>
  );
}
