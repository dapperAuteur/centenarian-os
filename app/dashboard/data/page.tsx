'use client';

// app/dashboard/data/page.tsx
// Centralized Data Hub — import/export for all modules.

import Link from 'next/link';
import {
  DollarSign, HeartPulse, Navigation, Fuel, Wrench, Car, Package,
  Users, CalendarClock, Dumbbell, ListChecks, Upload, Download, FileDown,
  Database,
} from 'lucide-react';

interface ModuleCard {
  slug: string;
  label: string;
  icon: React.ReactNode;
  exportUrl: string;
  importHref: string;
  templateUrl: string;
  description: string;
  filters?: string;
}

const MODULES: ModuleCard[] = [
  {
    slug: 'finance',
    label: 'Finance',
    icon: <DollarSign className="w-5 h-5" />,
    exportUrl: '/api/finance/export',
    importHref: '/dashboard/finance/import',
    templateUrl: '/templates/finance-import-template.csv',
    description: 'Transactions — income, expenses, and transfers',
    filters: '?from=YYYY-MM-DD&to=YYYY-MM-DD',
  },
  {
    slug: 'health-metrics',
    label: 'Health Metrics',
    icon: <HeartPulse className="w-5 h-5" />,
    exportUrl: '/api/health-metrics/export',
    importHref: '/dashboard/data/import/health-metrics',
    templateUrl: '/templates/health-metrics-import-template.csv',
    description: 'Daily logs — RHR, steps, sleep, activity, body composition',
    filters: '?from=YYYY-MM-DD&to=YYYY-MM-DD',
  },
  {
    slug: 'trips',
    label: 'Trips',
    icon: <Navigation className="w-5 h-5" />,
    exportUrl: '/api/travel/trips/export',
    importHref: '/dashboard/data/import/trips',
    templateUrl: '/templates/trips-import-template.csv',
    description: 'All trip logs — car, bike, walk, transit, flight',
    filters: '?from=&to=&mode=&trip_category=',
  },
  {
    slug: 'fuel',
    label: 'Fuel Logs',
    icon: <Fuel className="w-5 h-5" />,
    exportUrl: '/api/travel/fuel/export',
    importHref: '/dashboard/data/import/fuel',
    templateUrl: '/templates/fuel-import-template.csv',
    description: 'Fill-ups — gallons, cost, MPG, station',
    filters: '?from=&to=&vehicle_id=',
  },
  {
    slug: 'maintenance',
    label: 'Maintenance',
    icon: <Wrench className="w-5 h-5" />,
    exportUrl: '/api/travel/maintenance/export',
    importHref: '/dashboard/data/import/maintenance',
    templateUrl: '/templates/maintenance-import-template.csv',
    description: 'Vehicle service records and upcoming reminders',
    filters: '?vehicle_id=',
  },
  {
    slug: 'vehicles',
    label: 'Vehicles',
    icon: <Car className="w-5 h-5" />,
    exportUrl: '/api/travel/vehicles/export',
    importHref: '/dashboard/data/import/vehicles',
    templateUrl: '/templates/vehicles-import-template.csv',
    description: 'Your fleet — cars, bikes, trucks, boats',
    filters: '?include_retired=true',
  },
  {
    slug: 'equipment',
    label: 'Equipment',
    icon: <Package className="w-5 h-5" />,
    exportUrl: '/api/equipment/export',
    importHref: '/dashboard/data/import/equipment',
    templateUrl: '/templates/equipment-import-template.csv',
    description: 'Gear, tools, and merchandise tracking',
    filters: '?category_id=',
  },
  {
    slug: 'contacts',
    label: 'Contacts',
    icon: <Users className="w-5 h-5" />,
    exportUrl: '/api/contacts/export',
    importHref: '/dashboard/data/import/contacts',
    templateUrl: '/templates/contacts-import-template.csv',
    description: 'Vendors, customers, and saved locations',
    filters: '?type=vendor|customer|location',
  },
  {
    slug: 'tasks',
    label: 'Tasks',
    icon: <CalendarClock className="w-5 h-5" />,
    exportUrl: '/api/planner/export',
    importHref: '/dashboard/data/import/tasks',
    templateUrl: '/templates/tasks-import-template.csv',
    description: 'Planner tasks — daily, weekly, and recurring',
    filters: '?from=&to=&tag=&completed=true|false',
  },
  {
    slug: 'workouts',
    label: 'Workouts',
    icon: <Dumbbell className="w-5 h-5" />,
    exportUrl: '/api/workouts/logs/export',
    importHref: '/dashboard/data/import/workouts',
    templateUrl: '/templates/workouts-import-template.csv',
    description: 'Workout logs with exercises, sets, reps, weights',
    filters: '?from=YYYY-MM-DD&to=YYYY-MM-DD',
  },
  {
    slug: 'exercises',
    label: 'Exercises',
    icon: <ListChecks className="w-5 h-5" />,
    exportUrl: '/api/exercises/export',
    importHref: '/dashboard/data/import/exercises',
    templateUrl: '/templates/exercises-import-template.csv',
    description: 'Exercise library — instructions, cues, muscles, defaults',
  },
];

export default function DataHubPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Database className="w-6 h-6 text-fuchsia-600" />
          Data Hub
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Import and export your data across all modules. Download CSV templates, upload bulk data, or export filtered datasets.
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-4 text-sm text-gray-700 space-y-2">
        <p className="font-medium text-fuchsia-900">How it works</p>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li><strong>Export</strong> — click the Export button to download all your data as a CSV file. Add date range or filter parameters to the URL for filtered exports.</li>
          <li><strong>Import</strong> — download the CSV template, fill in your data, then upload it on the import page. Preview your data before confirming.</li>
          <li><strong>Google Sheets</strong> — publish your Google Sheet as CSV, then paste the URL on any import page.</li>
          <li><strong>Max 1,000 rows</strong> per import (200 for vehicles, 500 for contacts).</li>
        </ul>
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODULES.map((mod) => (
          <div
            key={mod.slug}
            className="bg-white border border-gray-200 rounded-xl p-5 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-fuchsia-50 rounded-xl flex items-center justify-center text-fuchsia-600">
                {mod.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{mod.label}</h3>
                <p className="text-xs text-gray-500">{mod.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={mod.importHref}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-50 text-fuchsia-700 rounded-lg text-xs font-semibold hover:bg-fuchsia-100 transition"
              >
                <Upload className="w-3 h-3" />
                Import
              </Link>
              <a
                href={mod.exportUrl}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition"
              >
                <Download className="w-3 h-3" />
                Export All
              </a>
              <a
                href={mod.templateUrl}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-100 transition"
              >
                <FileDown className="w-3 h-3" />
                Template
              </a>
            </div>

            {mod.filters && (
              <p className="text-[10px] text-gray-400 font-mono">
                Export filters: {mod.exportUrl}{mod.filters}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
