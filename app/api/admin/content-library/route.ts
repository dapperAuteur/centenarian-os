// app/api/admin/content-library/route.ts
// GET: list available tutorial content with import status
// POST: import a tutorial series into the Academy as a course

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

// All available tutorial series with metadata
const TUTORIAL_SERIES = [
  {
    slug: 'blog',
    title: 'Blog & Publishing Guide',
    description: 'Create, publish, and promote blog posts with video embedding, analytics, and social engagement.',
    category: 'Platform Guide',
    tags: ['tutorial', 'blog', 'publishing', 'video', 'analytics'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02'] },
      { title: 'Writing & Editing', order: 2, lessons: ['03', '04'] },
      { title: 'Publishing', order: 3, lessons: ['05', '06'] },
      { title: 'Engagement', order: 4, lessons: ['07', '08', '09'] },
    ],
  },
  {
    slug: 'exercises',
    title: 'Exercise Library Guide',
    description: 'Build and manage your exercise library with video demos, categories, social sharing, and workout integration.',
    category: 'Platform Guide',
    tags: ['tutorial', 'exercises', 'workouts', 'fitness', 'video'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02'] },
      { title: 'Content & Media', order: 2, lessons: ['03', '04'] },
      { title: 'Using Exercises', order: 3, lessons: ['05', '06'] },
      { title: 'Social & Data', order: 4, lessons: ['07', '08'] },
    ],
  },
  {
    slug: 'workouts',
    title: 'Workouts Guide',
    description: 'Create workout templates, log sessions with enhanced fields, use Nomad Longevity OS, and share with the community.',
    category: 'Platform Guide',
    tags: ['tutorial', 'workouts', 'fitness', 'nomad', 'templates'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03'] },
      { title: 'Advanced Training', order: 2, lessons: ['04', '05', '06'] },
      { title: 'Social & Data', order: 3, lessons: ['07', '08'] },
    ],
  },
  {
    slug: 'recipes',
    title: 'Recipes Guide',
    description: 'Create recipes with USDA nutrition data, NCV scoring, video demos, and Fuel integration.',
    category: 'Platform Guide',
    tags: ['tutorial', 'recipes', 'nutrition', 'ncv', 'cooking'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02'] },
      { title: 'Building Recipes', order: 2, lessons: ['03', '04'] },
      { title: 'Import & Media', order: 3, lessons: ['05', '06'] },
      { title: 'Social & Integration', order: 4, lessons: ['07', '08'] },
    ],
  },
  {
    slug: 'getting-started',
    title: 'Getting Started with CentenarianOS',
    description: 'Your first stop — explore the platform, pricing, demo account, and interactive walkthroughs.',
    category: 'Platform Guide',
    tags: ['tutorial', 'getting-started', 'onboarding', 'demo'],
    type: 'academy' as const,
    modules: [
      { title: 'Welcome', order: 1, lessons: ['01', '02'] },
      { title: 'Platform Tour', order: 2, lessons: ['03', '04', '05', '06'] },
    ],
  },
  {
    slug: 'planner',
    title: 'Mastering the Planner',
    description: 'Build roadmaps, set goals, schedule tasks, automate recurring work, and use AI-powered weekly reviews.',
    category: 'Platform Guide',
    tags: ['tutorial', 'planner', 'tasks', 'goals', 'roadmap'],
    type: 'academy' as const,
    modules: [
      { title: 'Foundation', order: 1, lessons: ['01', '02', '03'] },
      { title: 'Goals & Tasks', order: 2, lessons: ['04', '05', '06', '07'] },
      { title: 'Automation & Finance', order: 3, lessons: ['08', '09', '10'] },
      { title: 'Reflection & Insights', order: 4, lessons: ['11', '12', '13', '14'] },
    ],
  },
  {
    slug: 'finance',
    title: 'Finance Dashboard Guide',
    description: 'Track transactions, manage accounts, set budgets, link bank accounts, and import/export financial data.',
    category: 'Platform Guide',
    tags: ['tutorial', 'finance', 'budgets', 'transactions', 'banking'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03'] },
      { title: 'Dashboard & Data', order: 2, lessons: ['04', '05', '06'] },
    ],
  },
  {
    slug: 'travel',
    title: 'Travel & Vehicle Tracker Guide',
    description: 'Log trips, track fuel and maintenance, import Garmin activities, and manage your vehicle fleet.',
    category: 'Platform Guide',
    tags: ['tutorial', 'travel', 'vehicles', 'fuel', 'trips'],
    type: 'academy' as const,
    modules: [
      { title: 'Vehicles & Fuel', order: 1, lessons: ['01', '02', '03', '04', '05'] },
      { title: 'Trips & Maintenance', order: 2, lessons: ['06', '07', '08', '09', '10'] },
    ],
  },
  {
    slug: 'engine',
    title: 'Focus Engine Guide',
    description: 'Run focus sessions, use Pomodoro mode, track body checks, and analyze your productivity patterns.',
    category: 'Platform Guide',
    tags: ['tutorial', 'engine', 'focus', 'pomodoro', 'productivity'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03'] },
      { title: 'Advanced Features', order: 2, lessons: ['04', '05', '06', '07'] },
      { title: 'Analytics', order: 3, lessons: ['08', '09'] },
    ],
  },
  {
    slug: 'metrics',
    title: 'Health Metrics Guide',
    description: 'Track core metrics, unlock enrichment tiers, connect wearables, and import health data.',
    category: 'Platform Guide',
    tags: ['tutorial', 'health', 'metrics', 'wearables', 'oura', 'whoop', 'garmin'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03'] },
      { title: 'Advanced Tracking', order: 2, lessons: ['04', '05', '06', '07'] },
    ],
  },
  {
    slug: 'equipment',
    title: 'Equipment Tracker Guide',
    description: 'Track gear, electronics, and fitness equipment with valuations, categories, and cross-module links.',
    category: 'Platform Guide',
    tags: ['tutorial', 'equipment', 'assets', 'valuations'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03', '04'] },
      { title: 'Advanced', order: 2, lessons: ['05', '06', '07'] },
    ],
  },
  {
    slug: 'correlations',
    title: 'Correlations & Analytics Guide',
    description: 'Discover patterns between health, finance, and lifestyle metrics using Pearson correlation analysis.',
    category: 'Platform Guide',
    tags: ['tutorial', 'correlations', 'analytics', 'insights'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03'] },
      { title: 'Analysis', order: 2, lessons: ['04', '05', '06'] },
    ],
  },
  {
    slug: 'academy',
    title: 'Navigating the Centenarian Academy',
    description: 'Browse courses, enroll, navigate lessons, complete assignments, and use CYOA adventure mode.',
    category: 'Platform Guide',
    tags: ['tutorial', 'academy', 'courses', 'learning', 'cyoa'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03', '04'] },
      { title: 'Engagement', order: 2, lessons: ['05', '06', '07', '08'] },
      { title: 'Rich Media', order: 3, lessons: ['09', '10', '11', '12', '13'] },
    ],
  },
  {
    slug: 'teaching',
    title: 'Teaching Dashboard Guide',
    description: 'Create courses, build curricula, manage assignments, set up payouts, and schedule live sessions.',
    category: 'Platform Guide',
    tags: ['tutorial', 'teaching', 'courses', 'teacher', 'payouts'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03', '04'] },
      { title: 'Content & Students', order: 2, lessons: ['05', '06', '07'] },
      { title: 'Business', order: 3, lessons: ['08', '09'] },
    ],
  },
  {
    slug: 'settings',
    title: 'Settings & Billing Guide',
    description: 'Manage your subscription, connect wearables, upgrade plans, and re-take module tours.',
    category: 'Platform Guide',
    tags: ['tutorial', 'settings', 'billing', 'wearables', 'tours'],
    type: 'academy' as const,
    modules: [
      { title: 'Settings', order: 1, lessons: ['01', '02', '03', '04'] },
    ],
  },
  {
    slug: 'data-hub',
    title: 'Data Hub Guide',
    description: 'Import and export data across all modules using CSV, Google Sheets, and templates.',
    category: 'Platform Guide',
    tags: ['tutorial', 'data', 'import', 'export', 'csv'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03'] },
    ],
  },
  {
    slug: 'categories',
    title: 'Life Categories Guide',
    description: 'Tag activities across all modules with life-area labels and view analytics dashboards.',
    category: 'Platform Guide',
    tags: ['tutorial', 'categories', 'tags', 'analytics'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03'] },
      { title: 'Advanced', order: 2, lessons: ['04', '05'] },
    ],
  },
  {
    slug: 'coach',
    title: 'Coach & Gems Guide',
    description: 'Create AI coaching personas, run sessions with your real data, and generate flashcards.',
    category: 'Platform Guide',
    tags: ['tutorial', 'coach', 'gems', 'ai', 'coaching'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02', '03'] },
      { title: 'Using Coaching', order: 2, lessons: ['04', '05', '06', '07'] },
    ],
  },
  {
    slug: 'contractor',
    title: 'Contractor Job Hub Guide',
    description: 'Manage gigs, log hours, generate invoices, track union dues, and build your venue knowledge base.',
    category: 'Platform Guide',
    tags: ['tutorial', 'contractor', 'jobs', 'invoices', 'unions', 'venues'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02'] },
      { title: 'Jobs & Time Entries', order: 2, lessons: ['03', '04', '05'] },
      { title: 'Invoices & Rate Cards', order: 3, lessons: ['06', '07'] },
      { title: 'Venues & City Guides', order: 4, lessons: ['08', '09'] },
      { title: 'Union Tools', order: 5, lessons: ['10', '11'] },
      { title: 'Reports & Collaboration', order: 6, lessons: ['12', '13', '14'] },
    ],
  },
  {
    slug: 'lister',
    title: 'Lister & Crew Coordinator Guide',
    description: 'List jobs, manage your contractor roster, dispatch assignments, and communicate with your crew.',
    category: 'Platform Guide',
    tags: ['tutorial', 'lister', 'crew', 'assignments', 'messaging', 'roster'],
    type: 'academy' as const,
    modules: [
      { title: 'Getting Started', order: 1, lessons: ['01', '02'] },
      { title: 'Jobs & Assignments', order: 2, lessons: ['03', '04', '05'] },
      { title: 'Roster & Availability', order: 3, lessons: ['06', '07'] },
      { title: 'Messaging', order: 4, lessons: ['08', '09', '10'] },
      { title: 'Advanced', order: 5, lessons: ['11', '12'] },
    ],
  },
];

// Parse front matter and extract content from a tutorial markdown file
function parseTutorialMd(content: string) {
  const lines = content.split('\n');
  let title = '';
  let durationMin = 5;

  // Extract title from first heading
  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').replace(/^Lesson \d+:\s*/, '');
      break;
    }
  }

  // Extract duration
  for (const line of lines) {
    const match = line.match(/\*\*Duration:\*\*\s*~?(\d+)\s*min/);
    if (match) {
      durationMin = parseInt(match[1], 10);
      break;
    }
  }

  // Extract content after "## Narrator Script" or after the front matter separator
  let scriptStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^##\s+Narrator Script/)) {
      scriptStart = i + 1;
      break;
    }
  }

  // If no Narrator Script heading, take everything after the second ---
  if (scriptStart === -1) {
    let separatorCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        separatorCount++;
        if (separatorCount === 2) {
          scriptStart = i + 1;
          break;
        }
      }
    }
  }

  const textContent = scriptStart >= 0 ? lines.slice(scriptStart).join('\n').trim() : content;

  return { title, durationSeconds: durationMin * 60, textContent };
}

// GET: list all available tutorial series with import status
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const db = getDb();

  // Get existing courses by title to check import status
  const { data: courses } = await db
    .from('courses')
    .select('id, title, is_published, created_at')
    .eq('category', 'Platform Guide');

  const coursesByTitle = new Map(
    (courses ?? []).map((c: { id: string; title: string; is_published: boolean; created_at: string }) => [c.title, c]),
  );

  // Check which tutorial directories have content
  const tutorialsDir = path.join(process.cwd(), 'content', 'tutorials');

  const items = TUTORIAL_SERIES.map((series) => {
    const dirPath = path.join(tutorialsDir, series.slug);
    let fileCount = 0;
    let hasFiles = false;

    try {
      const files = fs.readdirSync(dirPath).filter((f: string) => f.endsWith('.md') && f !== '00-course-overview.md');
      fileCount = files.length;
      hasFiles = fileCount > 0;
    } catch {
      hasFiles = false;
    }

    const existing = coursesByTitle.get(series.title);

    return {
      slug: series.slug,
      title: series.title,
      description: series.description,
      type: series.type,
      lessonCount: fileCount,
      moduleCount: series.modules.length,
      hasFiles,
      imported: !!existing,
      courseId: existing?.id ?? null,
      isPublished: existing?.is_published ?? false,
      importedAt: existing?.created_at ?? null,
    };
  });

  return NextResponse.json(items);
}

// POST: import a tutorial series as a new Academy course
export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { slug } = await request.json();
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const series = TUTORIAL_SERIES.find((s) => s.slug === slug);
  if (!series) return NextResponse.json({ error: `Unknown series: ${slug}` }, { status: 404 });

  const db = getDb();

  // Check if already imported
  const { data: existing } = await db
    .from('courses')
    .select('id')
    .eq('title', series.title)
    .eq('category', 'Platform Guide')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This series has already been imported', courseId: existing.id }, { status: 409 });
  }

  // 1. Create the course
  const { data: course, error: courseErr } = await db
    .from('courses')
    .insert({
      teacher_id: user.id,
      title: series.title,
      description: series.description,
      category: series.category,
      tags: series.tags,
      price: 0,
      price_type: 'free',
      navigation_mode: 'cyoa',
      is_published: false,
    })
    .select()
    .single();

  if (courseErr || !course) {
    return NextResponse.json({ error: courseErr?.message ?? 'Failed to create course' }, { status: 500 });
  }

  // 2. Create modules
  const moduleIdMap = new Map<string, string>();
  for (const mod of series.modules) {
    const { data: moduleRow, error: modErr } = await db
      .from('course_modules')
      .insert({
        course_id: course.id,
        title: mod.title,
        order: mod.order,
      })
      .select('id')
      .single();

    if (modErr || !moduleRow) {
      console.error('Module creation error:', modErr);
      continue;
    }
    moduleIdMap.set(mod.title, moduleRow.id);
  }

  // 3. Read markdown files and create lessons
  const tutorialsDir = path.join(process.cwd(), 'content', 'tutorials', series.slug);
  let lessonsCreated = 0;
  const errors: string[] = [];

  for (const mod of series.modules) {
    const moduleId = moduleIdMap.get(mod.title);
    if (!moduleId) continue;

    for (let i = 0; i < mod.lessons.length; i++) {
      const lessonNum = mod.lessons[i];
      const filePath = path.join(tutorialsDir, `${lessonNum}-*.md`);

      // Find the actual file (glob-like matching)
      let actualFile: string | null = null;
      try {
        const allFiles = fs.readdirSync(tutorialsDir);
        actualFile = allFiles.find((f: string) => f.startsWith(`${lessonNum}-`) && f.endsWith('.md')) ?? null;
      } catch {
        errors.push(`Cannot read directory ${tutorialsDir}`);
        continue;
      }

      if (!actualFile) {
        errors.push(`File not found for lesson ${lessonNum} in ${series.slug}`);
        continue;
      }

      const content = fs.readFileSync(path.join(tutorialsDir, actualFile), 'utf-8');
      const parsed = parseTutorialMd(content);

      const { error: lessonErr } = await db
        .from('lessons')
        .insert({
          course_id: course.id,
          module_id: moduleId,
          title: parsed.title,
          lesson_type: 'text',
          text_content: parsed.textContent,
          content_format: 'markdown',
          duration_seconds: parsed.durationSeconds,
          is_free_preview: true,
          order: i + 1,
        });

      if (lessonErr) {
        errors.push(`Lesson ${lessonNum}: ${lessonErr.message}`);
      } else {
        lessonsCreated++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    courseId: course.id,
    title: series.title,
    modulesCreated: moduleIdMap.size,
    lessonsCreated,
    errors,
  });
}
