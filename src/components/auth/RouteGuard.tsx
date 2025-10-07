'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';

// Define public routes
const PUBLIC_ROUTES = [
  '/', // Assuming the root is a landing page
  '/login',
  '/signup',
  // Add other public routes here, e.g., '/about', '/contact'
];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // If loading, we don't know the auth status yet.
    if (loading) {
      return;
    }

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isLandingPageSubRoute = pathname.startsWith('/performer') || pathname.startsWith('/engineer') || pathname.startsWith('/manifesto'); // Assuming /landing and its sub-pages are public

    // If the user is not logged in and is trying to access a private route
    if (!user && !isPublicRoute && !isLandingPageSubRoute) {
      router.replace('/login');
    }

    // If the user is logged in and is on an auth page (like login/signup), redirect to dashboard
    if (user && (pathname === '/login' || pathname === '/signup')) {
      router.replace('/dashboard');
    }
  }, [user, loading, pathname, router]);

  // While authentication is loading, show a loading screen to prevent content flash
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <p className="text-foreground">Authenticating...</p>
      </div>
    );
  }

  // If authentication is complete, render the children
  return <>{children}</>;
}
