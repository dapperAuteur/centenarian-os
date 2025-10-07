// centenarian-os/src/app/(landing)/engineer/page.tsx
"use client"

import { useEffect } from 'react';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Code } from 'lucide-react';
import Link from 'next/link';

export default function EngineerShowcasePage() {
  useEffect(() => {
    analytics.then(an => {
      if (an) {
        logEvent(an, 'page_view', {
          page_title: 'Engineer Showcase',
          page_path: '/engineer',
        });
      }
    });
  }, []);
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12 text-center">
      <header className="mb-12">
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          The Architecture of Ambition
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          An open-source look into the Centenarian OS, a modular monolith built
          with a modern, type-safe stack.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Button asChild>
            <Link href="https://github.com/dapperAuteur/centenarian-os" target="_blank">
              View on GitHub
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Login or Sign Up</Link>
          </Button>
        </div>
      </header>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Core Principles of the Build</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-left">
            <p>
              <strong className="text-primary">Type-Safe State Management:</strong>{' '}
              Leveraging Zustand for simple, scalable, and fully type-safe
              global state.
            </p>
            <p>
              <strong className="text-primary">Offline-First Persistence:</strong>{' '}
              Using Firestore&apos;s real-time capabilities to ensure a seamless
              experience, online or off.
            </p>
            <p>
              <strong className="text-primary">Component-Driven UI:</strong>{' '}
              Built with shadcn/ui and Tailwind CSS for a modular, reusable,
              and beautiful design system.
            </p>
            <p>
              <strong className="text-primary">Secure by Default:</strong>{' '}
              Robust authentication and server-side security rules to ensure
              data integrity and user privacy.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
