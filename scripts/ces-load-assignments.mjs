// scripts/ces-load-assignments.mjs
// Inserts one graded assignment per module into the `assignments` table (scope='module'),
// scoped to one course. Idempotent: skips an assignment whose title already exists for the
// course. Run AFTER the course content load (modules must exist).
//
// Usage: node --env-file=.env.local scripts/ces-load-assignments.mjs <courseId> <assignmentsJson> [--dry-run]

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const courseId = process.argv[2];
const jsonPath = process.argv[3];
const DRY = process.argv.includes('--dry-run');
if (!courseId || !jsonPath) { console.error('Usage: ces-load-assignments.mjs <courseId> <assignmentsJson> [--dry-run]'); process.exit(2); }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const list = Array.isArray(items) ? items : (items.assignments || []);
  const { data: modules } = await db.from('course_modules').select('id, title').eq('course_id', courseId);
  const modByTitle = new Map((modules || []).map((m) => [m.title.toLowerCase().trim(), m.id]));
  const { data: existing } = await db.from('assignments').select('title').eq('course_id', courseId);
  const haveTitle = new Set((existing || []).map((a) => a.title));

  const stats = { inserted: 0, skipped: 0, noModule: 0, errors: [] };
  for (const a of list) {
    const title = a.assignmentTitle || a.title;
    const description = a.assignmentDescription || a.description || '';
    const moduleId = modByTitle.get((a.moduleTitle || '').toLowerCase().trim()) || null;
    if (!moduleId) { stats.noModule++; stats.errors.push(`No module match for "${a.moduleTitle}" (assignment "${title}")`); continue; }
    if (haveTitle.has(title)) { stats.skipped++; continue; }
    if (DRY) { console.log(`[dry] insert assignment "${title}" -> module ${moduleId}`); stats.inserted++; continue; }
    const { error } = await db.from('assignments').insert({ course_id: courseId, module_id: moduleId, title, description, scope: 'module' });
    if (error) stats.errors.push(`"${title}": ${error.message}`); else stats.inserted++;
  }
  console.log(JSON.stringify(stats, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
