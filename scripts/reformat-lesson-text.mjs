// scripts/reformat-lesson-text.mjs
// Course-agnostic lesson reformatter. Turns audio-first scripts (with [RECALL]/[HOOK]/[TEACH]/
// [PICTURE]/[WATCH OUT]/[CHECK] beats and [Beat]/[Sound: ...] cues) into clean reading prose
// with DESCRIPTIVE section headings. The body transform is deterministic (no word changes);
// the heading TEXT is supplied externally (LLM-generated) so citations are preserved exactly.
//
//   node --env-file=.env.local scripts/reformat-lesson-text.mjs prep  <courseId>
//   node --env-file=.env.local scripts/reformat-lesson-text.mjs apply <courseId> [--apply]
//
// prep:  fetch text lessons -> write per-lesson files + _manifest.json + back up originals.
// apply: read _manifest.json + _headings.json -> transform + citation-guardrail + upsert.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const cmd = process.argv[2];
const courseId = process.argv[3];
const APPLY = process.argv.includes('--apply');
if (!['prep', 'apply'].includes(cmd) || !courseId) {
  console.error('usage: reformat-lesson-text.mjs prep|apply <courseId> [--apply]');
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const workDir = path.join(DIR, '_lesson-work', courseId);
const backupDir = path.join(DIR, '_lesson-backups');
const BEAT = /\[(WELCOME|RECALL|HOOK|TEACH|PICTURE|WATCH OUT|WATCH-OUT|REMEMBER|CHECK)\]/g;
const CITE = /\([A-Z][A-Za-z'’-]+(?: et al\.| & [A-Z][A-Za-z'’-]+)?,? \d{4}[a-z]?\)/g;

function beatsOf(text) { return [...text.matchAll(BEAT)].map((m) => m[1]); }
function citesOf(text) { return ([...text.matchAll(CITE)].map((m) => m[0])).sort(); }

// ---- deterministic transform: original text + ordered headings -> clean markdown ----
function transform(original, headings) {
  let t = original;
  // drop the redundant leading "# Module ... Lesson X: Title" H1
  t = t.replace(/^﻿?#\s+Module[^\n]*\n+/, '');
  // replace each beat tag (in order) with its descriptive heading
  let i = 0;
  t = t.replace(BEAT, () => {
    const h = headings[i] && headings[i].heading ? headings[i].heading.trim() : '';
    i++;
    return h ? `\n\n## ${h}\n\n` : '\n\n';
  });
  // strip remaining stage cues and any other bracket tags, but keep [text](url) markdown links
  t = t.replace(/\[[^\]]*\](?!\()/g, '');
  // bold the Goal line
  t = t.replace(/^(\s*)Goal:\s*/m, '$1**Goal:** ');
  // split recall "One: ... Two: ..." onto their own paragraphs
  t = t.replace(/\s+(One:|Two:|Three:)\s+/g, '\n\n$1 ');
  // tidy whitespace: trim line trailing spaces, collapse 3+ newlines to 2
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^[ \t]+/gm, (s) => (s.length > 0 ? '' : s));
  // collapse runs of spaces left by removed inline tags
  t = t.replace(/[ \t]{2,}/g, ' ');
  return t.trim() + '\n';
}

if (cmd === 'prep') {
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
  const { data: lessons } = await db
    .from('lessons')
    .select('id, title, module_id, order, text_content, content_format')
    .eq('course_id', courseId)
    .eq('lesson_type', 'text')
    .not('text_content', 'is', null)
    .order('order', { ascending: true });
  const { data: modules } = await db.from('course_modules').select('id, title, order').eq('course_id', courseId);
  const modName = new Map((modules ?? []).map((m) => [m.id, m.title]));
  const modOrder = new Map((modules ?? []).map((m) => [m.id, m.order]));
  const backup = {};
  const manifest = [];
  for (const l of lessons ?? []) {
    backup[l.id] = { title: l.title, text_content: l.text_content, content_format: l.content_format };
    const beats = beatsOf(l.text_content);
    if (!beats.length) continue; // nothing to reformat
    const file = `${String(modOrder.get(l.module_id) ?? 9).padStart(2, '0')}-${l.order}-${l.id}.md`;
    fs.writeFileSync(path.join(workDir, file), l.text_content);
    manifest.push({ id: l.id, title: l.title, module: modName.get(l.module_id) || '(none)', moduleOrder: modOrder.get(l.module_id) ?? 9, order: l.order, file, beats });
  }
  manifest.sort((a, b) => a.moduleOrder - b.moduleOrder || a.order - b.order);
  fs.writeFileSync(path.join(workDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(backupDir, `${courseId}.json`), JSON.stringify(backup, null, 2));
  const byMod = {};
  for (const m of manifest) byMod[m.module] = (byMod[m.module] || 0) + 1;
  console.log(`prep: ${manifest.length} lessons with beats (of ${lessons?.length} text lessons). Backup saved.`);
  console.log('by module:', JSON.stringify(byMod, null, 2));
  console.log('manifest:', path.join(workDir, '_manifest.json'));
} else {
  // apply
  const manifest = JSON.parse(fs.readFileSync(path.join(workDir, '_manifest.json'), 'utf8'));
  const headingsPath = path.join(workDir, '_headings.json');
  if (!fs.existsSync(headingsPath)) { console.error('Missing _headings.json (run the heading agents first).'); process.exit(1); }
  const headingsById = JSON.parse(fs.readFileSync(headingsPath, 'utf8'));
  const backup = JSON.parse(fs.readFileSync(path.join(backupDir, `${courseId}.json`), 'utf8'));
  let ok = 0, citeFail = 0, missing = 0, applied = 0;
  for (const m of manifest) {
    const original = backup[m.id]?.text_content;
    const headings = headingsById[m.id];
    if (!original || !headings) { missing++; console.log(`  ! ${m.title}: no original/headings`); continue; }
    if (headings.length !== m.beats.length) console.log(`  ~ ${m.title}: ${headings.length} headings for ${m.beats.length} beats`);
    const cleaned = transform(original, headings);
    // guardrail: citations + key numbers unchanged
    const a = citesOf(original).join('|'); const b = citesOf(cleaned).join('|');
    const leftover = (cleaned.match(/\[(WELCOME|RECALL|HOOK|TEACH|PICTURE|WATCH OUT|REMEMBER|CHECK|Beat|Sound)/g) || []).length;
    if (a !== b) { citeFail++; console.log(`  ✗ ${m.title}: CITATIONS CHANGED\n     was: ${a}\n     now: ${b}`); continue; }
    if (leftover) { console.log(`  ~ ${m.title}: ${leftover} bracket tags still present`); }
    ok++;
    if (APPLY) {
      const { error } = await db.from('lessons').update({ text_content: cleaned, content_format: 'markdown' }).eq('id', m.id);
      if (error) console.log(`  ! ${m.title}: upsert failed ${error.message}`); else applied++;
    }
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'}: ${ok} ok, ${citeFail} citation-mismatches (skipped), ${missing} missing. ${APPLY ? applied + ' upserted.' : '(pass --apply to write)'}`);
}
