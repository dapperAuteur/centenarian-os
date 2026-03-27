// app/api/admin/content-status/route.ts
// Admin: returns last-modified dates for key content sources to detect staleness.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { stat } from 'fs/promises';
import { join } from 'path';

async function getAdminUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => { try { cookieStore.set({ name, value, ...options }); } catch {} },
        remove: (name: string, options: CookieOptions) => { try { cookieStore.set({ name, value: '', ...options }); } catch {} },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

interface ContentSource {
  key: string;
  label: string;
  description: string;
  path: string;
}

const CONTENT_SOURCES: ContentSource[] = [
  {
    key: 'help_rag',
    label: 'Help RAG Articles',
    description: 'In-app help chat knowledge base (lib/help/articles.ts)',
    path: 'lib/help/articles.ts',
  },
  {
    key: 'admin_education',
    label: 'Admin Education Context',
    description: 'AI assistant codebase context (lib/admin/codebase-context.ts)',
    path: 'lib/admin/codebase-context.ts',
  },
  {
    key: 'tutorial_getting_started',
    label: 'Tutorial: Getting Started',
    description: '6 lesson scripts for onboarding course',
    path: 'public/templates/tutorial-getting-started-import.csv',
  },
  {
    key: 'tutorial_settings',
    label: 'Tutorial: Settings & Billing',
    description: '4 lesson scripts for settings course',
    path: 'public/templates/tutorial-settings-import.csv',
  },
  {
    key: 'tutorial_finance',
    label: 'Tutorial: Finance',
    description: '10 lesson scripts for finance course',
    path: 'public/templates/tutorial-finance-import.csv',
  },
  {
    key: 'tutorial_travel',
    label: 'Tutorial: Travel',
    description: '14 lesson scripts for travel course',
    path: 'public/templates/tutorial-travel-import.csv',
  },
  {
    key: 'tutorial_planner',
    label: 'Tutorial: Planner',
    description: '14 lesson scripts for planner course',
    path: 'public/templates/tutorial-planner-import.csv',
  },
  {
    key: 'tutorial_workouts',
    label: 'Tutorial: Workouts',
    description: 'Workout tutorial course template',
    path: 'public/templates/tutorial-workouts-import.csv',
  },
  {
    key: 'tutorial_metrics',
    label: 'Tutorial: Health Metrics',
    description: '8 lesson scripts for metrics course',
    path: 'public/templates/tutorial-metrics-import.csv',
  },
  {
    key: 'tutorial_engine',
    label: 'Tutorial: Engine',
    description: '10 lesson scripts for focus engine course',
    path: 'public/templates/tutorial-engine-import.csv',
  },
  {
    key: 'tutorial_fuel',
    label: 'Tutorial: Fuel',
    description: '13 lesson scripts for fuel course',
    path: 'public/templates/tutorial-fuel-import.csv',
  },
  {
    key: 'tutorial_coach',
    label: 'Tutorial: Coach & Gems',
    description: '8 lesson scripts for coaching course (admin only)',
    path: 'public/templates/tutorial-coach-import.csv',
  },
  {
    key: 'tutorial_correlations',
    label: 'Tutorial: Correlations',
    description: '7 lesson scripts for analytics course',
    path: 'public/templates/tutorial-correlations-import.csv',
  },
  {
    key: 'tutorial_academy',
    label: 'Tutorial: Academy Student',
    description: '14 lesson scripts for academy guide',
    path: 'public/templates/tutorial-academy-import.csv',
  },
  {
    key: 'tutorial_teaching',
    label: 'Tutorial: Teaching Dashboard',
    description: '16 lesson scripts for teacher guide',
    path: 'public/templates/tutorial-teaching-import.csv',
  },
  {
    key: 'tutorial_equipment',
    label: 'Tutorial: Equipment',
    description: '8 lesson scripts for equipment tracker',
    path: 'public/templates/tutorial-equipment-import.csv',
  },
  {
    key: 'tutorial_data_hub',
    label: 'Tutorial: Data Hub',
    description: '3 lesson scripts for import/export',
    path: 'public/templates/tutorial-data-hub-import.csv',
  },
  {
    key: 'tutorial_categories',
    label: 'Tutorial: Life Categories',
    description: '6 lesson scripts for life categories',
    path: 'public/templates/tutorial-categories-import.csv',
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const user = await getAdminUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cwd = process.cwd();
  const now = Date.now();
  const STALE_DAYS = 30;

  const results = await Promise.all(
    CONTENT_SOURCES.map(async (source) => {
      try {
        const fullPath = join(cwd, source.path);
        const s = await stat(fullPath);
        const modifiedAt = s.mtime.toISOString();
        const daysSinceUpdate = Math.floor((now - s.mtime.getTime()) / (1000 * 60 * 60 * 24));
        const stale = daysSinceUpdate > STALE_DAYS;
        return {
          ...source,
          modifiedAt,
          daysSinceUpdate,
          stale,
          exists: true,
        };
      } catch {
        return {
          ...source,
          modifiedAt: null,
          daysSinceUpdate: null,
          stale: true,
          exists: false,
        };
      }
    }),
  );

  const staleCount = results.filter((r) => r.stale).length;

  return NextResponse.json({ sources: results, staleCount, staleDays: STALE_DAYS });
}
