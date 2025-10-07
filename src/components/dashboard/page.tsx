import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <h1 className="text-4xl font-bold mb-4 text-foreground">Welcome to Centenarian OS</h1>
      <p className="text-lg text-muted-foreground mb-8">Your operating system for a long, healthy life.</p>
      <div className="flex gap-4">
        <Button asChild><Link href="/login">Login</Link></Button>
        <Button variant="secondary" asChild><Link href="/signup">Sign Up</Link></Button>
      </div>
    </div>
  );
}
