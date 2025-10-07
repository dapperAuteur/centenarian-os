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
      // Wait until the initial loading is finished
      if (!loading && !user) {
        router.push('/login');
      }
    }, [user, loading, router]);

    // While loading, show a loading indicator to prevent any content flash
    if (loading) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <p className="text-foreground">Authenticating...</p>
        </div>
      );
    }

    // If there is a user, render the page.
    // Otherwise, the useEffect will have already started the redirect.
    if (user) {
      return <Component {...props} />;
    }

    // Return null to prevent rendering the component before the redirect is complete
    return null;
  };

  return AuthComponent;
};

export default withAuth;

