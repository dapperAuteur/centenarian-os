// lib/access/starter-modules.ts
// Single source of truth for Starter-tier ($5.46/mo, $51.80/yr — pick-3)
// access control. See plans/reports/01-plans-status-2026-04-16.md §16
// for the design and the owner decisions that shape this mapping.
//
// Two things live here:
//   1. STARTER_MODULES — the 8 pickable modules, each mapped to the
//      route prefix(es) that module unlocks.
//   2. STARTER_ALWAYS_INCLUDED_PREFIXES — paid-tier routes that are
//      always included for Starter (and every other tier) regardless
//      of what the user picked: Planner + Roadmap family, Academy,
//      Life Categories, Data Hub.
//
// Enforcement happens in app/dashboard/layout.tsx (redirects users
// away from forbidden prefixes) and components/nav/NavConfig.ts
// (filters nav items client-side so forbidden links don't render).
// Those consumers call expandToPrefixes() with the user's picked
// slugs to get the complete allow-list.

export type ModuleSlug =
  | 'engine'
  | 'fuel'
  | 'metrics'
  | 'workouts'
  | 'finance'
  | 'travel'
  | 'equipment'
  | 'correlations';

export const STARTER_PICK_LIMIT = 3;

export interface StarterModule {
  label: string;
  /** Every URL a Starter user with this module picked gets access to. */
  prefixes: string[];
  description: string;
  /** Lucide icon name. UI resolves to the actual component. */
  icon: string;
}

export const STARTER_MODULES: Record<ModuleSlug, StarterModule> = {
  engine: {
    label: 'Engine',
    prefixes: ['/dashboard/engine'],
    description: 'Focus sessions, analytics, doodle canvas',
    icon: 'Briefcase',
  },
  fuel: {
    label: 'Fuel',
    // Scan bundles with Fuel because the ingredient scanner is only
    // useful alongside supplement/fuel logging.
    prefixes: ['/dashboard/fuel', '/dashboard/scan'],
    description: 'Supplement protocols, daily fuel logs, ingredient scan',
    icon: 'Utensils',
  },
  metrics: {
    label: 'Health Metrics',
    prefixes: ['/dashboard/metrics'],
    description: 'RHR, steps, sleep, body composition, wearable sync',
    icon: 'HeartPulse',
  },
  workouts: {
    label: 'Workouts',
    // Exercises library is the builder surface for workout templates.
    prefixes: ['/dashboard/workouts', '/dashboard/exercises'],
    description: 'Exercise library, templates, logs, Nomad OS',
    icon: 'Dumbbell',
  },
  finance: {
    label: 'Finance',
    prefixes: ['/dashboard/finance'],
    description: 'Transactions, accounts, budgets, invoices, forecast',
    icon: 'DollarSign',
  },
  travel: {
    label: 'Travel',
    prefixes: ['/dashboard/travel'],
    description: 'Trips, vehicles, fuel logs, maintenance, routes',
    icon: 'Navigation',
  },
  equipment: {
    label: 'Equipment',
    // Media library bundles with Equipment — equipment's gallery is
    // the heaviest consumer of the library.
    prefixes: ['/dashboard/equipment', '/dashboard/media'],
    description: 'Asset tracking, valuations, media library & gallery',
    icon: 'Package',
  },
  correlations: {
    label: 'Correlations',
    // Analytics is the same cross-module analytics surface.
    prefixes: ['/dashboard/correlations', '/dashboard/analytics'],
    description: 'Cross-module analytics, AI insights',
    icon: 'TrendingUp',
  },
};

/**
 * Route prefixes that are always accessible for Starter users (and
 * every other tier) regardless of their picked modules. See
 * plans/reports/01-plans-status-2026-04-16.md §16.6 for the owner
 * decisions that shape this list.
 *
 * Note: this list does NOT include blog/recipes/billing/messages/
 * feedback/teaching/settings — those live in FREE_ROUTE_PREFIXES in
 * app/dashboard/layout.tsx and are available to free users too.
 * This list is specifically for paid routes that Starter gets
 * unconditionally (Planner family, Academy, Categories, Data).
 */
export const STARTER_ALWAYS_INCLUDED_PREFIXES: string[] = [
  '/dashboard/planner',
  '/dashboard/weekly-review',
  '/dashboard/retrospective',
  '/dashboard/roadmap',
  '/academy',
  '/dashboard/categories',
  '/dashboard/data',
];

export const STARTER_MODULE_SLUGS = Object.keys(STARTER_MODULES) as ModuleSlug[];

export function isModuleSlug(slug: string): slug is ModuleSlug {
  return slug in STARTER_MODULES;
}

/**
 * Expand a Starter user's picked module slugs into the full list of
 * route prefixes they have access to. Always-included prefixes come
 * first so they're cheapest to match when the dashboard layout scans
 * the list on every navigation.
 */
export function expandToPrefixes(slugs: string[] | null | undefined): string[] {
  const picked = (slugs ?? [])
    .filter(isModuleSlug)
    .flatMap((slug) => STARTER_MODULES[slug].prefixes);
  return [...STARTER_ALWAYS_INCLUDED_PREFIXES, ...picked];
}

/**
 * Returns true when the Starter-tier picked-module selection is a
 * valid final choice ready to send to Stripe checkout. Validates
 * count (exactly STARTER_PICK_LIMIT) and that every slug is known.
 */
export function isValidStarterSelection(slugs: string[]): boolean {
  if (slugs.length !== STARTER_PICK_LIMIT) return false;
  if (new Set(slugs).size !== slugs.length) return false;
  return slugs.every(isModuleSlug);
}
