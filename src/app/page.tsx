import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickCapture } from "@/components/dashboard/QuickCapture";
import { KpiCard } from "@/components/dashboard/KPICard";
import { PlanWidget } from "@/components/dashboard/PlanWidget";
import { Activity, HeartPulse, BedDouble, Dumbbell } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
          </div>

          <QuickCapture />

          <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            <KpiCard 
              title="Resting Heart Rate"
              value="48"
              unit="bpm"
              change="-2 from yesterday"
              changeType="increase"
              Icon={HeartPulse}
            />
            <KpiCard 
              title="Sleep Performance"
              value="92"
              unit="%"
              change="+5% from last night"
              changeType="increase"
              Icon={BedDouble}
            />
            <KpiCard 
              title="Grip Strength (L)"
              value="125.4"
              unit="lbs"
              change="+1.2 lbs from last week"
              changeType="increase"
              Icon={Dumbbell}
            />
            <KpiCard 
              title="Training Readiness"
              value="Optimal"
              unit=""
              change="Ready for high intensity"
              changeType="neutral"
              Icon={Activity}
            />
          </div>

          <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
              <PlanWidget />
              {/* Other widgets will go here */}
          </div>

        </main>
      </div>
    </div>
  );
}

