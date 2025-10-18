/* eslint-disable @typescript-eslint/no-unused-vars */
// centenarian-os/src/app/page.tsx

"use client"

import { KpiCard } from "@/components/dashboard/KPICard";
import { PlanWidget } from "@/components/dashboard/PlanWidget";
import { Dumbbell, Moon, Brain, BookOpen } from "lucide-react";
import { NewEntryDialog } from '@/components/dashboard/NewEntryDialog';
import PlanInitializer from "@/components/dashboard/PlanInitializer";

export default function Home() {
  return (
    <>
      <PlanInitializer />
      {/* The main content area now relies on the layout for the light background */}
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Centenarian OS Dashboard</h2>
          <div className="flex items-center space-x-2">
            <NewEntryDialog />
          </div>
        </div>
        
        {/* KPI Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard 
            title="Training Volume"
            value="4,231 lbs"
            change="+12.5% vs. avg"
            unit="this week"
            changeType={"increase"}
            Icon={Dumbbell}
            strategicAccent="fitness" // Strategic color: Lime for Fitness
            colorClass={"text-lime-500"}          />
          <KpiCard 
            title="Podcast Drafts"
            value="3"
            change="Target: +2 this week"
            unit="episodes"
            changeType={"increase"}
            Icon={BookOpen}
            strategicAccent="creative" // Strategic color: Sky for Creative
            colorClass={"text-lime-500"}          />
          <KpiCard 
            title="Sleep Score"
            value="88"
            change="+2% vs. baseline"
            unit="score"
            changeType={"increase"}
            Icon={Moon}
            strategicAccent="lifestyle" // Added Lifestyle type to KPICard definition for future use
            colorClass={"text-lime-500"}          />
          <KpiCard 
            title="Deep Work"
            value="3.5 hrs"
            change="-5.4% vs. target"
            unit="per day"
            changeType={"decrease"}
            Icon={Brain}
            strategicAccent="mindset" // Strategic color: Fuchsia for Mindset
            colorClass={"text-lime-500"}          />
        </div>

        {/* Plan Widget Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <PlanWidget /> 
          </div>
          <div className="lg:col-span-1">
            {/* Quick Capture / Notes (Future Component) */}
          </div>
        </div>
      </div>
    </>
  );
}
