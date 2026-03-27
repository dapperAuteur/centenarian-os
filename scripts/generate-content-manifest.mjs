#!/usr/bin/env node
// scripts/generate-content-manifest.mjs
// Runs at build time to snapshot file modification dates for the content status dashboard.
// Output: lib/generated/content-manifest.json (git-ignored, rebuilt each deploy)

import { statSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCES = [
  { key: 'help_rag', label: 'Help RAG Articles', description: 'In-app help chat knowledge base (lib/help/articles.ts)', path: 'lib/help/articles.ts' },
  { key: 'admin_education', label: 'Admin Education Context', description: 'AI assistant codebase context (lib/admin/codebase-context.ts)', path: 'lib/admin/codebase-context.ts' },
  { key: 'tutorial_getting_started', label: 'Tutorial: Getting Started', description: '6 lesson scripts for onboarding course', path: 'public/templates/tutorial-getting-started-import.csv' },
  { key: 'tutorial_settings', label: 'Tutorial: Settings & Billing', description: '4 lesson scripts for settings course', path: 'public/templates/tutorial-settings-import.csv' },
  { key: 'tutorial_finance', label: 'Tutorial: Finance', description: '10 lesson scripts for finance course', path: 'public/templates/tutorial-finance-import.csv' },
  { key: 'tutorial_travel', label: 'Tutorial: Travel', description: '14 lesson scripts for travel course', path: 'public/templates/tutorial-travel-import.csv' },
  { key: 'tutorial_planner', label: 'Tutorial: Planner', description: '14 lesson scripts for planner course', path: 'public/templates/tutorial-planner-import.csv' },
  { key: 'tutorial_workouts', label: 'Tutorial: Workouts', description: 'Workout tutorial course template', path: 'public/templates/tutorial-workouts-import.csv' },
  { key: 'tutorial_metrics', label: 'Tutorial: Health Metrics', description: '8 lesson scripts for metrics course', path: 'public/templates/tutorial-metrics-import.csv' },
  { key: 'tutorial_engine', label: 'Tutorial: Engine', description: '10 lesson scripts for focus engine course', path: 'public/templates/tutorial-engine-import.csv' },
  { key: 'tutorial_fuel', label: 'Tutorial: Fuel', description: '13 lesson scripts for fuel course', path: 'public/templates/tutorial-fuel-import.csv' },
  { key: 'tutorial_coach', label: 'Tutorial: Coach & Gems', description: '8 lesson scripts for coaching course (admin only)', path: 'public/templates/tutorial-coach-import.csv' },
  { key: 'tutorial_correlations', label: 'Tutorial: Correlations', description: '7 lesson scripts for analytics course', path: 'public/templates/tutorial-correlations-import.csv' },
  { key: 'tutorial_academy', label: 'Tutorial: Academy Student', description: '14 lesson scripts for academy guide', path: 'public/templates/tutorial-academy-import.csv' },
  { key: 'tutorial_teaching', label: 'Tutorial: Teaching Dashboard', description: '16 lesson scripts for teacher guide', path: 'public/templates/tutorial-teaching-import.csv' },
  { key: 'tutorial_equipment', label: 'Tutorial: Equipment', description: '8 lesson scripts for equipment tracker', path: 'public/templates/tutorial-equipment-import.csv' },
  { key: 'tutorial_data_hub', label: 'Tutorial: Data Hub', description: '3 lesson scripts for import/export', path: 'public/templates/tutorial-data-hub-import.csv' },
  { key: 'tutorial_categories', label: 'Tutorial: Life Categories', description: '6 lesson scripts for life categories', path: 'public/templates/tutorial-categories-import.csv' },
];

const results = SOURCES.map((source) => {
  try {
    const fullPath = join(ROOT, source.path);
    const s = statSync(fullPath);
    return { ...source, modifiedAt: s.mtime.toISOString(), exists: true };
  } catch {
    return { ...source, modifiedAt: null, exists: false };
  }
});

const outDir = join(ROOT, 'lib', 'generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'content-manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), sources: results }, null, 2),
);

console.log(`✓ Content manifest generated: ${results.filter((r) => r.exists).length}/${results.length} sources found`);
