// centenarian-os/src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCookie, setCookie } from 'cookies-next';
import { Loader2 } from 'lucide-react';

const LANDING_VARIANT_COOKIE = 'centenarian-os-variant';
const VARIANTS = ['/engineer', '/performer', '/manifesto'];

export default function LandingPageRouter() {
  const router = useRouter();

  useEffect(() => {
    // Assert the type to 'string' to resolve the ambiguity
    const assignedVariant = getCookie(LANDING_VARIANT_COOKIE) as string;

    if (assignedVariant && VARIANTS.includes(assignedVariant)) {
      router.replace(assignedVariant);
    } else {
      const randomVariant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
      setCookie(LANDING_VARIANT_COOKIE, randomVariant, {
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
      router.replace(randomVariant);
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}

