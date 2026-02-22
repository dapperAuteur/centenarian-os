// app/terms/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use | CentenarianOS',
  description: 'Terms of Use for CentenarianOS, operated by B4C LLC / AwesomeWebStore.com.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Terms of Use</h1>
        <p className="text-gray-400 text-sm mb-10">
          Last updated: February 21, 2026 &nbsp;·&nbsp; Operated by B4C LLC / AwesomeWebStore.com
        </p>

        <Section title="1. Acceptance of Terms">
          <p>
            By creating an account or using CentenarianOS ("the Platform," "we," "us"), you agree to
            these Terms of Use and our{' '}
            <Link href="/privacy" className="text-fuchsia-400 hover:underline">Privacy Policy</Link>.
            If you do not agree, do not use the Platform.
          </p>
          <p className="mt-3">
            The Platform is operated by B4C LLC and AwesomeWebStore.com. Anthony McDonald is the founder
            and operator. References to "CentenarianOS," "B4C LLC," "AwesomeWebStore.com," and
            "Anthony McDonald" in these terms refer collectively to the same operating entity and its
            principals.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 18 years old to use the Platform. By using the Platform you represent
            that you meet this requirement. If you are under 18, you may not create an account.
          </p>
        </Section>

        <Section title="3. Your Account">
          <p>
            You are responsible for maintaining the security of your account credentials. You agree not
            to share your password or allow others to access your account. You are responsible for all
            activity that occurs under your account.
          </p>
          <p className="mt-3">
            We reserve the right to suspend or terminate accounts that violate these Terms, engage in
            fraudulent activity, or misuse Platform features.
          </p>
        </Section>

        <Section title="4. Health Data — Your Responsibility">
          <p className="font-semibold text-yellow-400">
            IMPORTANT: CentenarianOS is a self-tracking and education platform. It is NOT a medical
            service, clinic, or healthcare provider.
          </p>
          <p className="mt-3">
            Any health metrics, biometric data, or personal health information you enter into the Platform
            is entered voluntarily by you. You are solely responsible for:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>The accuracy of the data you enter</li>
            <li>How you interpret, share, or act on that data</li>
            <li>Any decisions — including changes to diet, exercise, medication, or lifestyle — that
                you make based on information from the Platform</li>
          </ul>
          <p className="mt-3">
            <strong>CentenarianOS, B4C LLC, AwesomeWebStore.com, and Anthony McDonald are held harmless
            from any claims, damages, or liability arising from your use of health data tools, AI-generated
            insights, course content, or any other feature of the Platform.</strong>
          </p>
        </Section>

        <Section title="5. Medical Disclaimer — Consult Your Doctor">
          <p>
            Nothing on this Platform constitutes medical advice, diagnosis, or treatment. All content —
            including course lessons, AI-generated insights, blog posts, recipes, and health metric
            summaries — is for <strong>informational and educational purposes only</strong>.
          </p>
          <p className="mt-3">
            <strong>
              Always consult a qualified, licensed healthcare provider before making any changes to your
              health regimen, including changes to exercise, nutrition, supplements, or medications.
              Do not disregard or delay professional medical advice based on anything you read or learn
              on this Platform.
            </strong>
          </p>
          <p className="mt-3">
            Wearable device data (from Apple Watch, Fitbit, Garmin, Oura Ring, or similar devices) logged
            on the Platform is consumer-grade data. It is not a substitute for clinical measurement or
            medical testing.
          </p>
        </Section>

        <Section title="6. AI-Generated Content">
          <p>
            The Platform uses artificial intelligence (Google Gemini) to generate insights, course
            recommendations, and help responses. AI-generated content:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>May be inaccurate, incomplete, or outdated</li>
            <li>Is not a substitute for professional advice</li>
            <li>Should be verified before acting upon it</li>
          </ul>
          <p className="mt-3">
            CentenarianOS, B4C LLC, AwesomeWebStore.com, and Anthony McDonald make no warranties
            regarding the accuracy, reliability, or fitness for any purpose of AI-generated content.
          </p>
        </Section>

        <Section title="7. User-Generated Content">
          <p>
            You retain ownership of content you create on the Platform (blog posts, recipes, course
            materials, assignment submissions). By publishing content, you grant CentenarianOS a
            non-exclusive, royalty-free license to display and distribute that content through the
            Platform.
          </p>
          <p className="mt-3">
            You agree not to post content that is: unlawful, defamatory, harassing, sexually explicit,
            or that infringes on the intellectual property rights of others. We reserve the right to
            remove content that violates these standards.
          </p>
        </Section>

        <Section title="8. Centenarian Academy — Courses and Enrollments">
          <p>
            Centenarian Academy is a marketplace where independent teachers offer courses. CentenarianOS
            is the platform operator, not the employer or agent of any teacher. Course content reflects
            the views of the individual teacher, not CentenarianOS.
          </p>
          <p className="mt-3">
            Paid course enrollments are processed through Stripe. Refund eligibility is determined by
            the individual teacher's refund policy. Contact the teacher directly for refund requests.
            The platform fee (a percentage of each sale) is non-refundable.
          </p>
        </Section>

        <Section title="9. Prohibited Uses">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Use the Platform for any unlawful purpose</li>
            <li>Scrape, harvest, or systematically extract data from the Platform</li>
            <li>Attempt to gain unauthorized access to any account, system, or network</li>
            <li>Reproduce, redistribute, or resell Platform content without written permission</li>
            <li>Impersonate another person or entity</li>
            <li>Use the Platform to send unsolicited communications (spam)</li>
          </ul>
        </Section>

        <Section title="10. Intellectual Property">
          <p>
            The CentenarianOS brand, logo, platform design, and proprietary code are owned by B4C LLC /
            AwesomeWebStore.com. You may not use our trademarks or branding without written permission.
          </p>
        </Section>

        <Section title="11. Disclaimers and Limitation of Liability">
          <p>
            THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS
            OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, CENTENARIANOSS, B4C LLC,
            AWESOMEWEBSTORE.COM, AND ANTHONY MCDONALD DISCLAIM ALL WARRANTIES, INCLUDING FITNESS FOR A
            PARTICULAR PURPOSE AND NON-INFRINGEMENT.
          </p>
          <p className="mt-3">
            IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL
            DAMAGES ARISING FROM YOUR USE OF THE PLATFORM OR YOUR RELIANCE ON ANY CONTENT, INSIGHT, OR
            RECOMMENDATION PROVIDED THROUGH THE PLATFORM.
          </p>
        </Section>

        <Section title="12. Changes to These Terms">
          <p>
            We may update these Terms at any time. We will notify you of material changes by email or
            by displaying a notice on the Platform. Continued use after changes take effect constitutes
            your acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="13. Governing Law">
          <p>
            These Terms are governed by the laws of the State of Indiana, United States, without regard
            to its conflict of law provisions.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>
            Questions about these Terms? Contact us at{' '}
            <a href="mailto:hello@centenarianos.com" className="text-fuchsia-400 hover:underline">
              hello@centenarianos.com
            </a>
            .
          </p>
        </Section>

        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-4 text-sm text-gray-500">
          <Link href="/privacy" className="hover:text-gray-300 transition">Privacy Policy</Link>
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
