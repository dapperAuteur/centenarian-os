// centenarian-os/src/app/page.tsx
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { QuickCapture } from "@/components/dashboard/QuickCapture";
import { KpiCard } from "@/components/dashboard/KPICard";
import { PlanWidget } from "@/components/dashboard/PlanWidget";
import { Dumbbell, Moon, Brain, BookOpen } from "lucide-react";



import PlanInitializer from "@/components/dashboard/PlanInitializer";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <PlanInitializer />
      <Sidebar />
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <Header />
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          <div className="space-y-4">
            <QuickCapture />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard title="Training Volume" value="4,231 lbs" change="+12.5%" unit={""} changeType={"increase"} Icon={Dumbbell} />
              <KpiCard title="Sleep Score" value="88" change="+2%" unit={""} changeType={"increase"} Icon={Moon} />
              <KpiCard title="Deep Work" value="3.5 hrs" change="-5.4%" unit={""} changeType={"increase"} Icon={Brain} />
              <KpiCard title="Read Time" value="45 mins" change="+20%" unit={""} changeType={"increase"} Icon={BookOpen} />
            </div>
            <PlanWidget />
          </div>
        </main>
      </div>
    </div>
  );
}
