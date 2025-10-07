/* eslint-disable @typescript-eslint/no-unused-vars */
// centenarian-os/src/app/page.tsx

"use client"

import Header from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
// import QuickCapture from "@/components/dashboard/QuickCapture"; // Assuming this is part of the original component list
import { KpiCard } from "@/components/dashboard/KPICard";
import { PlanWidget } from "@/components/dashboard/PlanWidget";
import { Dumbbell, Moon, Brain, BookOpen, PlusCircle } from "lucide-react";
import { NewEntryDialog } from '@/components/dashboard/NewEntryDialog';
import PlanInitializer from "@/components/dashboard/PlanInitializer";

// This component uses the light, clean aesthetic established in the Style Guide.
export default function Home() {
  return (
    // The main container should enforce the light aesthetic
    <div className="min-h-screen bg-gray-50"> 
      <PlanInitializer />
      {/* The inner spacing is adjusted for better look and feel */}
      <div className="flex-1 space-y-8 p-4 md:p-10 pt-8 max-w-7xl mx-auto">
        
        {/* Dashboard Header */}
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-4xl font-extrabold tracking-tight text-gray-900">
            Centenarian OS Dashboard
          </h2>
          <div className="flex items-center space-x-2">
            {/* New Entry Dialog (Quick Action) */}
            <NewEntryDialog />
          </div>
        </div>
        
        {/* 1. KPI Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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

        {/* 2. Main Widgets Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Plan Widget takes up 2/3 of the space on large screens */}
          <div className="lg:col-span-2">
            <PlanWidget /> 
          </div>
          
          {/* Example of a secondary widget (e.g., Reflection/Notes) */}
          <div className="lg:col-span-1">
            {/* You would place a NotesWidget or QuickCapture here */}
            <h3 className="text-xl font-bold text-gray-800 mb-4">Weekly Focus</h3>
            <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-sky-500">
                <p className="text-gray-700">Priority this week: Finalize and **Record Fitness Metrics Class**. Secondary focus on maximizing upper body strength endurance.</p>
                <ul className="list-disc list-inside text-sm text-gray-500 mt-3 space-y-1">
                    <li>Push/Pull Max Reps (M/W/F)</li>
                    <li>Corvid Podcast Recording (M)</li>
                    <li>Teacher Outreach (Daily Micro-actions)</li>
                </ul>
            </div>
          </div>
        </div>
        
        {/* Placeholder for future Multi-Week Strategy Component */}
        <div className="pt-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Multi-Week Strategy Overview</h3>
            <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-fuchsia-500 h-64 flex items-center justify-center">
                <p className="text-gray-500">Future integration of the full 5-Week **StrategyTemplate** component here.</p>
            </div>
        </div>

      </div>
    </div>
  );
}
