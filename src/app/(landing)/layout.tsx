// centenarian-os/src/app/(landing)/layout.tsx
import { ReactNode } from 'react';

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-grow">{children}</main>
    </div>
  );
}
