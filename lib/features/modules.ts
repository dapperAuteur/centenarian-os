// lib/features/modules.ts
// Centralized module data used by the homepage, features index, and individual landing pages.

import {
  Target, Utensils, Brain, Car, DollarSign, Heart, Dumbbell, Flame,
  Package, GraduationCap, BookOpen, TrendingUp, Database, ChartNetwork,
  Camera, Tag, History, HardHat, Users, type LucideIcon,
} from 'lucide-react';

export interface ModuleHighlight {
  title: string;
  description: string;
}

export interface ModuleData {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  color: string;           // border color class
  iconColor: string;       // text color class
  checkColor: string;
  bgGradient: string;      // hero gradient classes
  Icon: LucideIcon;
  features: string[];
  highlights: ModuleHighlight[];
  dashboardPath: string;
  tutorialSlug?: string;   // matches content/tutorials/{slug}
  relatedSlugs: string[];
}

export const MODULES: ModuleData[] = [
  {
    slug: 'planner',
    name: 'The Planner',
    tagline: 'From decade-long visions to today\'s to-do list',
    description: 'Hierarchical goal tracking from multi-decade roadmaps down to daily tasks. Break massive ambitions into manageable, trackable steps and watch your progress compound.',
    color: 'border-fuchsia-500',
    iconColor: 'text-fuchsia-600',
    checkColor: 'text-fuchsia-600',
    bgGradient: 'from-fuchsia-600 to-fuchsia-800',
    Icon: Target,
    features: [
      'Roadmap → Goals → Milestones → Tasks',
      'Week/3-day/daily views',
      'Real-time progress tracking',
    ],
    highlights: [
      {
        title: 'Four-Level Hierarchy',
        description: 'Organize thinking at every scale: Roadmaps hold big-picture goals, goals break into milestones, milestones into tasks. Every task you complete rolls up into visible progress.',
      },
      {
        title: 'Flexible Time Views',
        description: 'Switch between weekly, 3-day, and daily views so you can plan ahead or focus on right now. Drag tasks between days when priorities shift.',
      },
      {
        title: 'Contacts & Locations',
        description: 'Attach saved contacts and locations to tasks for quick context. See at a glance who you\'re meeting and where.',
      },
      {
        title: 'Cross-Module Links',
        description: 'Link tasks to trips, transactions, equipment, or workouts. Your plan connects to everything else you track.',
      },
    ],
    dashboardPath: '/dashboard/planner',
    tutorialSlug: 'planner',
    relatedSlugs: ['engine', 'categories', 'connections'],
  },
  {
    slug: 'fuel',
    name: 'The Fuel',
    tagline: 'Know exactly what you\'re putting into your body',
    description: 'Nutrition tracking with the NCV framework. Score every ingredient, build recipes, and optimize your diet for performance and longevity.',
    color: 'border-sky-500',
    iconColor: 'text-sky-600',
    checkColor: 'text-sky-600',
    bgGradient: 'from-sky-600 to-sky-800',
    Icon: Utensils,
    features: [
      'Ingredient library with cost tracking',
      'Green/Yellow/Red scoring',
      'Recipe import from any URL',
      'Auto inventory management',
    ],
    highlights: [
      {
        title: 'NCV Scoring Framework',
        description: 'Every ingredient is categorized Green (eat freely), Yellow (moderate), or Red (limit). Recipes get an overall score so you can make better choices at a glance.',
      },
      {
        title: 'One-Click Recipe Import',
        description: 'Paste any recipe URL and the scraper extracts ingredients, instructions, and nutrition data automatically. No manual entry required.',
      },
      {
        title: 'Cost-Per-Serving Tracking',
        description: 'Log ingredient prices and see the true cost of every meal. Budget-conscious eating without sacrificing quality.',
      },
      {
        title: 'Inventory Management',
        description: 'Track what you have on hand. When you cook a recipe, ingredients are automatically decremented so your shopping list stays accurate.',
      },
    ],
    dashboardPath: '/dashboard/fuel',
    tutorialSlug: 'fuel',
    relatedSlugs: ['health-metrics', 'scanner', 'finance'],
  },
  {
    slug: 'engine',
    name: 'The Engine',
    tagline: 'Measure focus, energy, and daily momentum',
    description: 'Focus tracking, Pomodoro timers, and daily debriefs to maintain momentum. Understand your productivity patterns and optimize your working hours.',
    color: 'border-lime-500',
    iconColor: 'text-lime-600',
    checkColor: 'text-lime-600',
    bgGradient: 'from-lime-600 to-lime-800',
    Icon: Brain,
    features: [
      'Pomodoro focus sessions linked to tasks',
      'Daily energy/focus ratings',
      'Body check & pain tracking',
      'Weekly AI-powered reviews',
    ],
    highlights: [
      {
        title: 'Task-Linked Focus Timer',
        description: 'Start a Pomodoro session directly from a planner task. When the timer ends, the session is linked to the task so you see exactly where your time goes.',
      },
      {
        title: 'Daily Debrief',
        description: 'Rate your energy, focus, and mood each day. Track body sensations and pain. Over time, spot patterns between how you feel and what you accomplish.',
      },
      {
        title: 'Pain Tracking & History',
        description: 'Log pain by body location, intensity, and sensation type. View trends over time to share with healthcare providers or identify triggers.',
      },
      {
        title: 'AI-Powered Weekly Reviews',
        description: 'At the end of each week, an AI synthesis pulls together your focus data, debrief ratings, and task completion into actionable insights.',
      },
    ],
    dashboardPath: '/dashboard/engine',
    tutorialSlug: 'engine',
    relatedSlugs: ['planner', 'correlations', 'health-metrics'],
  },
  {
    slug: 'travel',
    name: 'Travel & Vehicles',
    tagline: 'Track every mile, fuel-up, and trip cost',
    description: 'Comprehensive travel logging — vehicles, fuel, maintenance, trips, and multi-stop routes. Know the real cost of getting from A to B.',
    color: 'border-amber-500',
    iconColor: 'text-amber-600',
    checkColor: 'text-amber-600',
    bgGradient: 'from-amber-600 to-amber-800',
    Icon: Car,
    features: [
      'Vehicle profiles & fuel logging with OCR',
      'Trip tracking (car, bike, walk, run)',
      'Bike savings vs. car cost-per-mile',
      'Garmin activity import',
    ],
    highlights: [
      {
        title: 'Vehicle Profiles',
        description: 'Track multiple vehicles with ownership type, tax category, and fuel efficiency. Retire old vehicles while keeping their history.',
      },
      {
        title: 'OCR Fuel Receipts',
        description: 'Snap a photo of your fuel receipt. Gemini Vision extracts gallons, price, odometer, and station automatically.',
      },
      {
        title: 'Multi-Stop Routes',
        description: 'Plan complex journeys with multiple legs. Each stop can have its own mode of transport, and costs are tracked per-leg with linked finance transactions.',
      },
      {
        title: 'Bike Savings Calculator',
        description: 'See how much you save by biking instead of driving. Compares your car\'s cost-per-mile against zero-cost bike trips.',
      },
    ],
    dashboardPath: '/dashboard/travel',
    tutorialSlug: 'travel',
    relatedSlugs: ['finance', 'scanner', 'equipment'],
  },
  {
    slug: 'finance',
    name: 'Financial Dashboard',
    tagline: 'Complete financial visibility in one place',
    description: 'Full financial tracking — accounts, budgets, brands, invoices, and P&L reporting. From daily expenses to annual financial reviews.',
    color: 'border-emerald-500',
    iconColor: 'text-emerald-600',
    checkColor: 'text-emerald-600',
    bgGradient: 'from-emerald-600 to-emerald-800',
    Icon: DollarSign,
    features: [
      'Checking, savings, credit card, loan, cash',
      'Bank linking via Teller for auto-sync',
      'Budget categories with spending charts',
      'Invoices with custom fields & CSV import',
    ],
    highlights: [
      {
        title: 'Multi-Account Tracking',
        description: 'Add checking, savings, credit card, loan, and cash accounts. Each tracks its balance from an opening balance plus all transactions.',
      },
      {
        title: 'Budget Categories & Charts',
        description: 'Create custom budget categories with monthly targets. See spending breakdowns as pie charts and bar graphs. Get alerted when you\'re over budget.',
      },
      {
        title: 'Brand P&L',
        description: 'If you run a side business or freelance, tag transactions by brand. View profit and loss statements per brand with monthly trend analysis.',
      },
      {
        title: 'Invoice Generator',
        description: 'Create professional invoices with custom fields, line items, and tax calculations. Export as CSV or share directly with clients.',
      },
    ],
    dashboardPath: '/dashboard/finance',
    tutorialSlug: 'finance',
    relatedSlugs: ['travel', 'equipment', 'scanner'],
  },
  {
    slug: 'health-metrics',
    name: 'Health Metrics',
    tagline: 'Your complete daily health picture',
    description: 'Daily vitals logging and wearable integration. Track resting heart rate, steps, sleep, activity, and body composition — manually or via device sync.',
    color: 'border-rose-500',
    iconColor: 'text-rose-600',
    checkColor: 'text-rose-600',
    bgGradient: 'from-rose-600 to-rose-800',
    Icon: Heart,
    features: [
      'RHR, steps, sleep, activity minutes',
      'Garmin, Oura Ring & WHOOP sync',
      'Body composition tracking',
      'CSV import (Apple Health, InBody)',
    ],
    highlights: [
      {
        title: 'Three-Tier Metrics',
        description: 'Core metrics (RHR, steps, sleep, activity) are always available. Enrichment metrics unlock per-metric for deeper tracking. Body composition data is separate and private.',
      },
      {
        title: 'Wearable Auto-Sync',
        description: 'Connect Garmin, Oura Ring, or WHOOP via OAuth. Daily metrics sync automatically in the background — no manual entry needed.',
      },
      {
        title: 'Trend Visualization',
        description: 'View your metrics over time with interactive charts. Spot patterns in sleep quality, resting heart rate trends, and activity consistency.',
      },
      {
        title: 'Flexible Import',
        description: 'Import historical data from Apple Health, Google Health, InBody scans, and Hume Health via CSV. Your data history, unified in one place.',
      },
    ],
    dashboardPath: '/dashboard/metrics',
    tutorialSlug: 'metrics',
    relatedSlugs: ['correlations', 'workouts', 'engine'],
  },
  {
    slug: 'workouts',
    name: 'Workouts & Exercises',
    tagline: 'Your gym, your library, your data',
    description: 'Build custom workout templates from a personal exercise library. Track sets, reps, RPE, tempo, and supersets with post-workout feedback.',
    color: 'border-cyan-500',
    iconColor: 'text-cyan-600',
    checkColor: 'text-cyan-600',
    bgGradient: 'from-cyan-600 to-cyan-800',
    Icon: Dumbbell,
    features: [
      'Exercise library with categories & muscle groups',
      'Workout templates with RPE, tempo & supersets',
      'Post-workout mood & difficulty feedback',
      'CSV import/export via Data Hub',
    ],
    highlights: [
      {
        title: 'Personal Exercise Library',
        description: 'Catalog every exercise with instructions, form cues, video/audio, muscle groups, and default parameters. 10 auto-seeded categories to start.',
      },
      {
        title: 'Advanced Tracking',
        description: 'Log RPE, tempo, superset groups, percent of max, isometric holds, negative reps, and unilateral/balance work. As detailed as you want.',
      },
      {
        title: 'Equipment Linking',
        description: 'Associate exercises with equipment items you own. See which gear gets the most use and plan workouts around what you have available.',
      },
      {
        title: 'Post-Workout Feedback',
        description: 'After each workout, rate mood, difficulty, and leave notes. Track how training affects your mental state over time.',
      },
    ],
    dashboardPath: '/dashboard/workouts',
    relatedSlugs: ['nomad', 'exercises', 'health-metrics'],
  },
  {
    slug: 'nomad',
    name: 'Nomad Longevity OS',
    tagline: 'Peak performance training, anywhere in the world',
    description: 'A complete workout protocol designed for travelers, remote workers, and anyone who needs to stay fit without a fixed gym. AM priming, PM recovery, hotel, and gym programs.',
    color: 'border-orange-600',
    iconColor: 'text-orange-600',
    checkColor: 'text-orange-600',
    bgGradient: 'from-orange-600 to-orange-800',
    Icon: Flame,
    features: [
      'AM Priming, PM Recovery, Hotel & Gym workouts',
      'Friction Protocol for stress resilience',
      '28 exercises from the Nomad Glossary',
      'Post-workout mood & difficulty tracking',
    ],
    highlights: [
      {
        title: 'Four Training Modes',
        description: 'AM Priming wakes up your nervous system. PM Recovery winds down. Hotel workouts need zero equipment. Gym workouts leverage full facilities.',
      },
      {
        title: 'Friction Protocol',
        description: 'A deliberate stress inoculation practice: cold exposure, breath work, and uncomfortable holds. Build resilience that transfers to every area of life.',
      },
      {
        title: 'Pre-Loaded Exercise Library',
        description: '28 exercises from the Nomad Glossary are auto-seeded into your library. Each has detailed instructions and form cues.',
      },
      {
        title: 'Travel-Optimized',
        description: 'Every workout is designed for minimal or no equipment. Whether you\'re in a hotel room, park, or airport lounge — you have a program.',
      },
    ],
    dashboardPath: '/dashboard/workouts/nomad',
    relatedSlugs: ['workouts', 'health-metrics', 'engine'],
  },
  {
    slug: 'equipment',
    name: 'Equipment & Assets',
    tagline: 'Know what you own and what it\'s worth',
    description: 'Track tools, gear, and possessions — purchase price, current value, depreciation, and cross-module links. Your personal asset register.',
    color: 'border-stone-500',
    iconColor: 'text-stone-600',
    checkColor: 'text-stone-600',
    bgGradient: 'from-stone-600 to-stone-800',
    Icon: Package,
    features: [
      'Equipment categories with auto-seeding',
      'Valuation history with chart visualization',
      'Link equipment to trips, workouts, finance',
      'Total asset value dashboard',
    ],
    highlights: [
      {
        title: 'Categorized Inventory',
        description: 'Organize equipment into custom categories (auto-seeded with defaults). Each item tracks purchase date, price, condition, and notes.',
      },
      {
        title: 'Value Over Time',
        description: 'Record periodic valuations and see how your assets appreciate or depreciate. Interactive charts show value trends for individual items.',
      },
      {
        title: 'Transaction Linking',
        description: 'Link equipment to the financial transaction where you bought it. Multiple items can share one transaction (e.g., a bulk order).',
      },
      {
        title: 'Cross-Module Connections',
        description: 'Link gear to workouts (which equipment did you use?), trips (what did you bring?), and maintenance records.',
      },
    ],
    dashboardPath: '/dashboard/equipment',
    tutorialSlug: 'equipment',
    relatedSlugs: ['finance', 'workouts', 'travel'],
  },
  {
    slug: 'academy',
    name: 'Academy',
    tagline: 'Learn, teach, and earn — all in one LMS',
    description: 'A full learning management system. Create courses with video, text, quizzes, and interactive maps. Sell your courses or take free tutorials.',
    color: 'border-violet-500',
    iconColor: 'text-violet-600',
    checkColor: 'text-violet-600',
    bgGradient: 'from-violet-600 to-violet-800',
    Icon: GraduationCap,
    features: [
      'Video, text, audio, quiz & map lessons',
      'Choose Your Own Adventure navigation',
      'Assignments, certificates & badges',
      '14 free tutorial course series',
    ],
    highlights: [
      {
        title: 'Rich Lesson Types',
        description: 'Create video lessons, rich text articles, audio content, multiple-choice quizzes, interactive map lessons, and document-based assignments.',
      },
      {
        title: 'CYOA Navigation',
        description: 'Courses can use linear progression or Choose Your Own Adventure mode, where AI suggests related lessons based on content similarity.',
      },
      {
        title: 'Teach & Earn',
        description: 'Become a teacher with a teacher subscription. Set your course price, and receive payouts via Stripe Connect. The platform handles payments.',
      },
      {
        title: 'Free Tutorial Library',
        description: '15+ tutorial series teach every CentenarianOS module. Free for all users — the best way to learn the platform.',
      },
    ],
    dashboardPath: '/academy',
    tutorialSlug: 'academy',
    relatedSlugs: ['blog-recipes', 'data-hub'],
  },
  {
    slug: 'blog-recipes',
    name: 'Blog & Recipes',
    tagline: 'Share knowledge and meals with the community',
    description: 'Community content publishing with rich text editing and recipe sharing. Public profiles, likes, saves, and recipe import from any URL.',
    color: 'border-orange-500',
    iconColor: 'text-orange-600',
    checkColor: 'text-orange-600',
    bgGradient: 'from-orange-600 to-orange-700',
    Icon: BookOpen,
    features: [
      'Rich text editor with media upload',
      'Public recipe pages with likes & saves',
      'Recipe import from any URL',
      'Public author/cook profiles',
    ],
    highlights: [
      {
        title: 'Rich Text Publishing',
        description: 'Write blog posts with a full-featured editor. Upload images via Cloudinary, format text, and publish to a public audience.',
      },
      {
        title: 'Recipe Sharing',
        description: 'Share your favorite recipes with ingredients, instructions, cook time, and NCV scores. Community members can like and save recipes.',
      },
      {
        title: 'One-Click Import',
        description: 'Found a recipe online? Paste the URL and the scraper extracts all structured data (JSON-LD schema.org/Recipe) automatically.',
      },
      {
        title: 'Public Profiles',
        description: 'Your author profile showcases your published posts and shared recipes. Build a following around your content.',
      },
    ],
    dashboardPath: '/dashboard/blog',
    relatedSlugs: ['fuel', 'academy'],
  },
  {
    slug: 'correlations',
    name: 'Correlations & Analytics',
    tagline: 'Find what actually moves the needle',
    description: 'Cross-module data correlation engine. Discover connections between habits, nutrition, health metrics, and productivity outcomes.',
    color: 'border-teal-500',
    iconColor: 'text-teal-600',
    checkColor: 'text-teal-600',
    bgGradient: 'from-teal-600 to-teal-800',
    Icon: TrendingUp,
    features: [
      'Cross-module data correlation engine',
      'Daily & weekly aggregate views',
      'Trend charts across all tracked metrics',
      'Actionable insight summaries',
    ],
    highlights: [
      {
        title: 'Cross-Module Analysis',
        description: 'The correlation engine pulls data from health metrics, engine ratings, finance, travel, and workouts to find patterns you\'d never spot manually.',
      },
      {
        title: 'Trend Visualization',
        description: 'Interactive charts overlay multiple data streams. See how sleep quality correlates with focus ratings, or how exercise frequency affects mood.',
      },
      {
        title: 'Weekly & Daily Aggregates',
        description: 'View data at different time scales. Daily detail for recent investigation, weekly aggregates for longer-term trend analysis.',
      },
      {
        title: 'Actionable Summaries',
        description: 'Not just charts — the system highlights the strongest correlations and suggests what to experiment with next.',
      },
    ],
    dashboardPath: '/dashboard/correlations',
    tutorialSlug: 'correlations',
    relatedSlugs: ['health-metrics', 'engine', 'analytics'],
  },
  {
    slug: 'data-hub',
    name: 'Data Hub',
    tagline: 'Your data, your way — import and export everything',
    description: 'Centralized import and export for every module. CSV templates, Google Sheets compatibility, date-range filtering, and bulk operations.',
    color: 'border-indigo-500',
    iconColor: 'text-indigo-600',
    checkColor: 'text-indigo-600',
    bgGradient: 'from-indigo-600 to-indigo-800',
    Icon: Database,
    features: [
      'CSV import/export for all 12+ modules',
      'Date-range filtering on exports',
      'Google Sheets compatible templates',
      'Bulk course importer for Academy',
    ],
    highlights: [
      {
        title: '12+ Module Support',
        description: 'Import and export data for finance, health metrics, trips, fuel, maintenance, vehicles, equipment, contacts, tasks, workouts, and more.',
      },
      {
        title: 'Smart Templates',
        description: 'Download pre-formatted CSV templates with example rows. Fill them in and upload — the importer validates and maps data automatically.',
      },
      {
        title: 'Date-Range Exports',
        description: 'Export exactly the data you need. Filter by date range and module-specific fields to get clean, focused exports.',
      },
      {
        title: 'Bulk Operations',
        description: 'Import hundreds of records at once. The system handles deduplication, validation, and linked record creation (like auto-creating milestones for tasks).',
      },
    ],
    dashboardPath: '/dashboard/data',
    tutorialSlug: 'data-hub',
    relatedSlugs: ['finance', 'health-metrics', 'equipment'],
  },
  {
    slug: 'connections',
    name: 'Cross-Module Connections',
    tagline: 'Link everything to everything',
    description: 'Bidirectional activity links across every module. Connect tasks to trips, transactions to equipment, and workouts to exercises. Your data graph, not data silos.',
    color: 'border-pink-500',
    iconColor: 'text-pink-600',
    checkColor: 'text-pink-600',
    bgGradient: 'from-pink-600 to-pink-800',
    Icon: ChartNetwork,
    features: [
      'Bidirectional activity links (task↔trip↔equipment)',
      'Saved contacts with location sub-entries',
      'Contact autocomplete with default category',
      'Task contacts & location assignment',
    ],
    highlights: [
      {
        title: 'Activity Links',
        description: 'Create bidirectional links between any two entities: tasks, trips, transactions, recipes, workouts, equipment, and more. Each link shows context from both sides.',
      },
      {
        title: 'Saved Contacts',
        description: 'Build a personal contact directory with vendors, customers, and locations. Each contact can have multiple location sub-entries with addresses and coordinates.',
      },
      {
        title: 'Smart Autocomplete',
        description: 'When entering contacts in any module, the autocomplete suggests saved contacts sorted by usage frequency. Select one and its default category auto-fills.',
      },
      {
        title: 'Location Intelligence',
        description: 'Contacts have location sub-entries that integrate with the travel module for trip origins/destinations and the planner for task locations.',
      },
    ],
    dashboardPath: '/dashboard/categories',
    relatedSlugs: ['planner', 'categories', 'finance'],
  },
  {
    slug: 'scanner',
    name: 'Universal Scanner',
    tagline: 'Point, shoot, and extract data instantly',
    description: 'Camera-based data extraction powered by Gemini Vision AI. Scan receipts, ingredient labels, business cards, and documents into any module.',
    color: 'border-yellow-500',
    iconColor: 'text-yellow-600',
    checkColor: 'text-yellow-600',
    bgGradient: 'from-yellow-600 to-yellow-800',
    Icon: Camera,
    features: [
      'OCR receipt scanning for fuel & finance',
      'Ingredient label scanning for Fuel module',
      'Multi-photo upload (up to 4 images)',
      'Gemini Vision AI extraction',
    ],
    highlights: [
      {
        title: 'Receipt Scanning',
        description: 'Photograph any receipt — fuel, grocery, or general expense. The AI extracts vendor, amount, date, and line items into your finance or fuel module.',
      },
      {
        title: 'Ingredient Labels',
        description: 'Scan nutrition labels and ingredient lists. The AI parses macros, ingredients, and serving sizes directly into your Fuel ingredient library.',
      },
      {
        title: 'Multi-Photo Support',
        description: 'Upload up to 4 images per scan. Useful for long receipts, front-and-back labels, or multiple documents in one batch.',
      },
      {
        title: 'Smart Routing',
        description: 'After extraction, the scanner routes data to the right module. A fuel receipt goes to fuel logs; a grocery receipt goes to finance transactions.',
      },
    ],
    dashboardPath: '/dashboard/scan',
    relatedSlugs: ['finance', 'fuel', 'travel'],
  },
  {
    slug: 'categories',
    name: 'Life Categories',
    tagline: 'Tag your life by what matters most',
    description: 'User-defined life-area tags that work across every module. Tag expenses, tasks, workouts, and more with Health, Career, Finance, or any custom category.',
    color: 'border-purple-500',
    iconColor: 'text-purple-600',
    checkColor: 'text-purple-600',
    bgGradient: 'from-purple-600 to-purple-800',
    Icon: Tag,
    features: [
      'User-defined tags (Health, Career, Finance, etc.)',
      'Works across all 11 module types',
      'Spending & activity analytics by category',
      'Batch tagging from the dashboard',
    ],
    highlights: [
      {
        title: 'Custom Categories',
        description: 'Start with 8 auto-seeded defaults (Health, Finance, Career, etc.) and add your own. Each has an icon and color for easy visual identification.',
      },
      {
        title: 'Universal Tagging',
        description: 'Tag tasks, trips, transactions, workouts, equipment, recipes, focus sessions, exercises, and daily logs. Every module supports life categories.',
      },
      {
        title: 'Analytics Dashboard',
        description: 'See spending by life category (pie chart), activity counts by category (bar chart), and find uncategorized items that need tagging.',
      },
      {
        title: 'Batch Tagging',
        description: 'The uncategorized items view lets you rapidly tag multiple items at once. Keep your data organized without tedious one-by-one editing.',
      },
    ],
    dashboardPath: '/dashboard/categories',
    tutorialSlug: 'categories',
    relatedSlugs: ['connections', 'planner', 'finance'],
  },
  {
    slug: 'retrospective',
    name: 'Life Retrospective',
    tagline: 'AI-powered reviews that connect the dots',
    description: 'Periodic reviews that synthesize data across every module. Import your Google Calendar, overlay it with tracked data, and let AI surface insights.',
    color: 'border-slate-500',
    iconColor: 'text-slate-600',
    checkColor: 'text-slate-600',
    bgGradient: 'from-slate-600 to-slate-800',
    Icon: History,
    features: [
      'Cross-module data synthesis',
      'Google Calendar .ics import',
      'Patterns across health, finance & productivity',
      'Gemini AI narrative generation',
    ],
    highlights: [
      {
        title: 'Cross-Module Synthesis',
        description: 'The retrospective pulls data from health metrics, focus sessions, finances, travel, and workouts into a single narrative view.',
      },
      {
        title: 'Calendar Integration',
        description: 'Import .ics files from Google Calendar to overlay your schedule with tracked data. See how meetings correlate with productivity dips.',
      },
      {
        title: 'AI Narrative Generation',
        description: 'Gemini AI writes a personalized review highlighting your strongest patterns, biggest changes, and suggested focus areas for the next period.',
      },
      {
        title: 'Periodic Cadence',
        description: 'Run retrospectives weekly, monthly, quarterly, or annually. Each timeframe reveals different patterns and insights.',
      },
    ],
    dashboardPath: '/dashboard/retrospective',
    relatedSlugs: ['correlations', 'engine', 'health-metrics'],
  },
  {
    slug: 'contractor',
    name: 'Contractor Hub (JobHub)',
    tagline: 'Your gigs, hours, invoices, and union tools — one place',
    description: 'A dedicated workspace for independent contractors in broadcast, production, and live events. Track jobs, log hours, generate invoices, manage rate cards, build venue knowledge bases, and stay on top of union memberships and dues.',
    color: 'border-amber-500',
    iconColor: 'text-amber-600',
    checkColor: 'text-amber-600',
    bgGradient: 'from-amber-600 to-amber-800',
    Icon: HardHat,
    features: [
      'Job tracking from assignment to payment',
      'Time entry logging with ST/OT/DT auto-calc',
      'One-click invoice generation from hours',
      'Rate cards, venue KB, city guides, union RAG',
    ],
    highlights: [
      {
        title: 'Job Lifecycle Management',
        description: 'Track every gig from assignment through payment. Store client, event, venue, dates, rates, department, and union local. Link invoices, trips, and expenses to each job.',
      },
      {
        title: 'Invoice Generation',
        description: 'Generate invoices directly from time entries. Line items auto-calculated from your rates and logged hours — ST, OT, and DT with correct rates applied.',
      },
      {
        title: 'Venue Knowledge Base',
        description: 'Build a reference for every venue: parking, load-in, WiFi, power, catering, security. Upload schematics and share with your crew.',
      },
      {
        title: 'Union Contract Chat',
        description: 'Upload union contracts and ask questions in plain language. AI searches your documents and returns relevant sections. Plus track memberships and dues across multiple locals.',
      },
    ],
    dashboardPath: '/dashboard/contractor',
    tutorialSlug: 'contractor',
    relatedSlugs: ['finance', 'travel', 'lister'],
  },
  {
    slug: 'lister',
    name: 'Lister Platform (CrewOps)',
    tagline: 'Staff your crews, dispatch with confidence',
    description: 'Crew management for coordinators, staffing agencies, and union leaders. Create jobs, manage your contractor roster, dispatch assignments, and communicate via individual and group messaging.',
    color: 'border-indigo-500',
    iconColor: 'text-indigo-600',
    checkColor: 'text-indigo-600',
    bgGradient: 'from-indigo-600 to-indigo-800',
    Icon: Users,
    features: [
      'Job creation and multi-position staffing',
      'Contractor roster with skills and availability',
      'Assignment dispatch with status tracking',
      'Individual and group messaging',
    ],
    highlights: [
      {
        title: 'Assignment Dispatch',
        description: 'Assign contractors from your roster to specific jobs. Track offered, accepted, declined, and removed statuses. Reassign on the fly when plans change.',
      },
      {
        title: 'Crew Roster',
        description: 'Maintain a curated list of contractors with skills, availability notes, and contact info. Filter by skill when staffing specific positions.',
      },
      {
        title: 'Group Messaging',
        description: 'Organize your roster into messaging groups by department, geography, or event type. Broadcast crew calls and rate updates to targeted groups.',
      },
      {
        title: 'Union Leader Tools',
        description: 'Union leaders get additional capabilities: member directory, seniority tracking, job priority flags, minimum rate enforcement, and dispatch queue.',
      },
    ],
    dashboardPath: '/dashboard/contractor/lister',
    tutorialSlug: 'lister',
    relatedSlugs: ['contractor', 'finance'],
  },
];

export function getModuleBySlug(slug: string): ModuleData | undefined {
  return MODULES.find((m) => m.slug === slug);
}

export function getRelatedModules(slugs: string[]): ModuleData[] {
  return slugs.map((s) => MODULES.find((m) => m.slug === s)).filter(Boolean) as ModuleData[];
}
