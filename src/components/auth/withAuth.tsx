// centenarian-os/src/components/auth/withAuth.tsx
'use client';

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, ComponentType } from 'react';

const withAuth = <P extends object>(Component: ComponentType<P>) => {
  const AuthComponent = (props: P) => {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      // If authentication is complete and there is no user,
      // redirect them to the login page.
      if (!loading && !user) {
        router.replace('/login');
      }
    }, [user, loading, router]);

    // While loading, show a loading screen. This prevents any flash of protected content.
    if (loading) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <p className="text-foreground">Authenticating...</p>
        </div>
      );
    }
    
    // If there's a user, render the component. Otherwise, the useEffect will have already initiated a redirect.
    return user ? <Component {...props} /> : null;
  };

  AuthComponent.displayName = `WithAuth(${Component.displayName || Component.name || 'Component'})`;

  return AuthComponent;
};

export default withAuth;
