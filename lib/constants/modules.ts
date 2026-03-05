// lib/constants/modules.ts
// Canonical module names for usage tracking and analytics.

export const MODULES = {
  FINANCE: 'finance',
  TRAVEL: 'travel',
  PLANNER: 'planner',
  HEALTH_METRICS: 'health_metrics',
  WORKOUTS: 'workouts',
  EXERCISES: 'exercises',
  EQUIPMENT: 'equipment',
  RECIPES: 'recipes',
  ACADEMY: 'academy',
  LIFE_CATEGORIES: 'life_categories',
  CONTACTS: 'contacts',
  DATA_HUB: 'data_hub',
  FOCUS: 'focus',
} as const;

export type ModuleName = (typeof MODULES)[keyof typeof MODULES];
