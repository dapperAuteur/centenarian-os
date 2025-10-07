// centenarian-os/src/app/dashboard/page.tsx
"use client"

import { KpiCard } from "@/components/dashboard/KPICard";
import { PlanWidget } from "@/components/dashboard/PlanWidget";
import { Dumbbell, Moon, Brain, BookOpen } from "lucide-react";
import { NewEntryDialog } from '@/components/dashboard/NewEntryDialog';
import PlanInitializer from "@/components/dashboard/PlanInitializer";

/**
 * Dashboard Page - Main landing page for the Centenarian OS
 * 
 * LAYOUT STRUCTURE:
 * 1. Header with title and CTA button
 * 2. KPI Cards Grid (4 cards showing key metrics)
 * 3. Main Content Grid:
 *    - Plan Widget (2/3 width on large screens)
 *    - Weekly Focus Widget (1/3 width on large screens)
 * 4. Future: Multi-Week Strategy Component
 * 
 * DESIGN NOTES:
 * - Uses light, clean aesthetic with gray-50 background
 * - Strategic color palette: lime (fitness), sky (creative), fuchsia (mindset)
 * - Responsive grid that collapses on mobile
 * - All cards have subtle shadows and hover effects
 */
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50"> 
      {/* Initialize Firebase listeners for real-time data sync */}
      <PlanInitializer />
      
      {/* Main Content Container */}
      <div className="flex-1 space-y-8 p-4 md:p-10 pt-8 max-w-7xl mx-auto">
        
        {/* ===== SECTION 1: Dashboard Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
              Centenarian OS <span className="text-lime-600">Dashboard</span>
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Your personal operating system for a healthier, more productive life.
            </p>
          </div>
          
          {/* Primary CTA */}
          <div className="flex items-center space-x-2">
            <NewEntryDialog />
          </div>
        </div>
        
        {/* ===== SECTION 2: KPI Cards Grid ===== */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard 
            title="Training Volume"
            value="4,231"
            unit="lbs"
            change="+12.5% vs. avg"
            changeType="increase"
            Icon={Dumbbell}
            strategicAccent="fitness"
            colorClass="text-lime-500"
          />
          
          <KpiCard 
            title="Podcast Drafts"
            value="3"
            unit="episodes"
            change="Target: +2 this week"
            changeType="increase"
            Icon={BookOpen}
            strategicAccent="creative"
            colorClass="text-sky-500"
          />
          
          <KpiCard 
            title="Sleep Score"
            value="88"
            unit="score"
            change="+2% vs. baseline"
            changeType="increase"
            Icon={Moon}
            strategicAccent="lifestyle"
            colorClass="text-teal-500"
          />
          
          <KpiCard 
            title="Deep Work"
            value="3.5"
            unit="hrs/day"
            change="-5.4% vs. target"
            changeType="decrease"
            Icon={Brain}
            strategicAccent="mindset"
            colorClass="text-fuchsia-500"
          />
        </div>

        {/* ===== SECTION 3: Main Widgets Grid ===== */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Plan Widget - Takes 2/3 width on large screens */}
          <div className="lg:col-span-2">
            <PlanWidget /> 
          </div>
          
          {/* Weekly Focus Widget - Takes 1/3 width on large screens */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-sky-500 h-full">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Weekly Focus
              </h3>
              
              {/* Priority Statement */}
              <div className="mb-4">
                <p className="text-gray-700 leading-relaxed">
                  Priority this week: <strong>Finalize and Record Fitness Metrics Class</strong>. 
                  Secondary focus on maximizing upper body strength endurance.
                </p>
              </div>
              
              {/* Key Actions List */}
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-lime-50 rounded-lg border-l-4 border-lime-500">
                  <span className="text-lime-600 font-bold text-sm">FIT</span>
                  <p className="text-sm text-gray-700 flex-1">
                    Push/Pull Max Reps (M/W/F)
                  </p>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-sky-50 rounded-lg border-l-4 border-sky-500">
                  <span className="text-sky-600 font-bold text-sm">CREATE</span>
                  <p className="text-sm text-gray-700 flex-1">
                    Corvid Podcast Recording (M)
                  </p>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-amber-50 rounded-lg border-l-4 border-amber-500">
                  <span className="text-amber-600 font-bold text-sm">REACH</span>
                  <p className="text-sm text-gray-700 flex-1">
                    Teacher Outreach (Daily Micro-actions)
                  </p>
                </div>
              </div>
              
              {/* Weekly Progress Bar */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Weekly Progress</span>
                  <span className="text-sm font-bold text-gray-900">62%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-lime-500 to-sky-500 transition-all duration-700 ease-out" 
                    style={{ width: '62%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* ===== SECTION 4: Multi-Week Strategy Placeholder ===== */}
        <div className="pt-4">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Multi-Week Strategy Overview
          </h3>
          <div className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-fuchsia-500 min-h-[300px] flex items-center justify-center">
            <div className="text-center">
              <svg 
                className="w-16 h-16 mx-auto text-gray-300 mb-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <p className="text-gray-500 font-medium">
                Future integration of the full 5-Week <strong>StrategyTemplate</strong> component here.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                This will display your quarterly planning roadmap with weekly breakdowns.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}