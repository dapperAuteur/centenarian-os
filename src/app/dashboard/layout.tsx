// centenarian-os/src/app/dashboard/layout.tsx
import Header from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

// This layout component defines the persistent structure for the entire
// dashboard section of the application. It includes the Header and Sidebar.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        {/* CRITICAL FIX: Set light background (bg-gray-50) for the canvas 
            and explicitly apply the 'light' class to ensure correct theme variables are used. */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 bg-gray-50 light">
          {children}
        </main>
      </div>
    </>
  );
}
