// centenarian-os/src/app/(landing)/performer/page.tsx
"use client"

import { useEffect } from 'react';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Zap, Target } from 'lucide-react';
import Link from 'next/link';

export default function HighPerformerPage() {
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
          Stop Juggling Apps. Start Integrating Ambition.
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          The Centenarian OS is the single source of truth for your long-term
          goals. Translate your multi-decade vision into daily, data-driven
          execution.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Button asChild size="lg">
            <Link href="/signup">Sign Up for Free</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/login">Login</Link>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Zap className="h-6 w-6 text-primary" /> Quick Capture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Capture tasks and ideas instantly before they disappear.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" /> Daily Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Execute on a clear, prioritized plan every single day.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Target className="h-6 w-6 text-primary" /> KPI Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Monitor your key metrics to ensure you&apos;re on track.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
