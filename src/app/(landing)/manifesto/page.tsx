// centenarian-os/src/app/(landing)/manifesto/page.tsx
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ManifestoPage() {
  return (
    <div className="container mx-auto flex h-full min-h-[80vh] max-w-4xl flex-col items-center justify-center px-4 py-12 text-center">
      <header>
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
          In 2095, I&apos;ll run the 100-meter dash. This is the system that will
          get me there.
        </h1>
        <p className="mt-8 text-lg leading-8 text-muted-foreground">
          The journey to 100 is not a series of sprints; it&apos;s a single,
          integrated campaign. Most tools are built for tasks, not for sagas.
          The Centenarian OS is an operating system for the campaign of your
          life.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Button asChild size="lg">
            <Link href="/signup">Start Your Journey</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/login">Login to Your OS</Link>
          </Button>
        </div>
      </header>
    </div>
  );
}
