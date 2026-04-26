// app/demo/layout.tsx
// Demo page layout with metadata.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Try the Demo',
  description: 'Explore CentenarianOS with a full-featured demo account. No signup required. See the planner, finance tracker, travel module, and more.',
  openGraph: {
    title: 'Try the Demo · CentenarianOS',
    description: 'Explore CentenarianOS with a full-featured demo account. No signup required.',
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
