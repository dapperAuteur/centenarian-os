// scripts/export-course-to-vetting.mjs
//
// Export a live Academy course (and optionally its teacher course) from Supabase to
// flat per-module Markdown + PDF for offline review/vetting. Reflects whatever is in
// the DB right now, so re-run it after editing a course.
//
// Output per course: <prefix>-00-INDEX, <prefix>-M<NN>-<slug>-{SCRIPT,QUIZ,ASSIGNMENT},
// and (main course) <prefix>-99-GLOSSARY. Each as .md and a typographic .pdf (jsPDF,
// no headless browser).
//
// Usage:
//   node scripts/export-course-to-vetting.mjs <courseId> [options]
//
// Options:
//   --prefix <P>        file prefix (default: first segment of the course slug, upper)
//   --teacher <id>      also export this teacher course as <prefix>-TEACHER-*
//   --out <dir>         output directory (default: /Users/bam/Code_NOiCloud/Course-Vetting)
//   --footer <text>     PDF footer (default: the course title)
//   --no-glossary       skip the glossary file for the main course
//   --no-clean          do not delete existing <prefix>-* files first
//
// Example (the FAA Part 107 course + its teacher toolkit):
//   node scripts/export-course-to-vetting.mjs 8d4a1aa3-edaa-4d18-b412-541e43f243c8 \
//     --prefix FAA --teacher 5bac01f4-d6c8-4875-affd-f828b2744e05

import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import { createClient } from '@supabase/supabase-js';

// ---- args ----
const argv = process.argv.slice(2);
const courseId = argv.find((a) => !a.startsWith('--'));
const opt = (name, def = null) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes(name);
if (!courseId) { console.error('Usage: node scripts/export-course-to-vetting.mjs <courseId> [--prefix P] [--teacher id] [--out dir] [--footer text] [--no-glossary] [--no-clean]'); process.exit(1); }
const OUT = opt('--out', '/Users/bam/Code_NOiCloud/Course-Vetting');
const TEACHER_ID = opt('--teacher');
const includeGlossary = !flag('--no-glossary');
const doClean = !flag('--no-clean');

// ---- env + db ----
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ---- helpers ----
const pad2 = (n) => String(n).padStart(2, '0');
const kebab = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function moduleSlug(title) {
  const m = title.match(/^Module\s+(\d+)\s*:\s*(.+)$/i);
  return m ? `module-${m[1]}-${kebab(m[2])}` : kebab(title);
}

const MARGIN = 54, PAGE_W = 612, PAGE_H = 792, MAXW = PAGE_W - MARGIN * 2;
const flatten = (tokens) => (tokens || []).map((t) => {
  if (t.type === 'br') return '\n';
  if (t.tokens) return flatten(t.tokens);
  return t.text || t.raw || '';
}).join('');
function renderPdf(md, title, footer) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = MARGIN;
  const ensure = (h) => { if (y + h > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; } };
  const write = (text, { size = 10.5, style = 'normal', indent = 0, gap = 4, color = [20, 20, 20] } = {}) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color);
    const lh = size * 1.35;
    for (const para of String(text).split('\n')) {
      for (const line of doc.splitTextToSize(para, MAXW - indent)) { ensure(lh); doc.text(line, MARGIN + indent, y); y += lh; }
    }
    y += gap;
  };
  if (title) write(title, { size: 19, style: 'bold', gap: 6 });
  for (const tok of marked.lexer(md)) {
    if (tok.type === 'heading') { const sizes = { 1: 17, 2: 14, 3: 12 }; y += tok.depth <= 2 ? 8 : 4; write(flatten(tok.tokens), { size: sizes[tok.depth] || 11.5, style: 'bold', gap: 3, color: [10, 10, 10] }); }
    else if (tok.type === 'paragraph') write(flatten(tok.tokens), { size: 10.5, gap: 6 });
    else if (tok.type === 'list') { for (const item of tok.items) { const marker = tok.ordered ? `${(tok.start || 1) + tok.items.indexOf(item)}.` : '•'; const txt = flatten(item.tokens).replace(/\n+/g, ' ').trim(); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(20, 20, 20); const lh = 10.5 * 1.35; doc.splitTextToSize(txt, MAXW - 18).forEach((line, i) => { ensure(lh); if (i === 0) doc.text(marker, MARGIN, y); doc.text(line, MARGIN + 18, y); y += lh; }); y += 2; } y += 4; }
    else if (tok.type === 'hr') { ensure(12); doc.setDrawColor(180); doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 12; }
    else if (tok.type === 'blockquote') write(flatten(tok.tokens), { size: 10.5, style: 'italic', indent: 14, gap: 6, color: [70, 70, 70] });
    else if (tok.type === 'table') { if (tok.header) write(tok.header.map((c) => flatten(c.tokens || [])).join('  |  '), { size: 9.5, style: 'bold', gap: 2 }); for (const r of tok.rows || []) write(r.map((c) => flatten(c.tokens || [])).join('  |  '), { size: 9.5, gap: 2, color: [40, 40, 40] }); y += 4; }
    else if (tok.type === 'code') write(tok.text, { size: 9, indent: 10, gap: 6, color: [60, 60, 60] });
    else if (tok.type === 'space') y += 4;
  }
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150); doc.text(`${footer}  ·  ${p} / ${n}`, MARGIN, PAGE_H - 28); }
  return doc;
}
function writeFile(base, md, footer) {
  fs.writeFileSync(path.join(OUT, base + '.md'), md);
  const body = md.replace(/^#\s+.+\n/, '');
  const h1 = (md.match(/^#\s+(.+)$/m) || [])[1] || base;
  fs.writeFileSync(path.join(OUT, base + '.pdf'), Buffer.from(renderPdf(body, h1, footer).output('arraybuffer')));
}
function quizSection(lesson) {
  const qc = lesson.quiz_content || {};
  const qs = qc.questions || [];
  let out = `## ${lesson.title}\n\nPool of ${qs.length} questions, passing ${qc.passingScore ?? 80}%.\n\n`;
  qs.forEach((q, i) => {
    out += `### Q${i + 1}. ${q.questionText}\n`;
    for (const o of q.options) out += `- ${o.id === q.correctOptionId ? '**[correct]** ' : ''}${o.text}\n`;
    if (q.explanation) out += `\n_Why:_ ${q.explanation}\n`;
    if (q.citation) out += `_Ref:_ ${q.citation}\n`;
    if (q.lessonRef?.title) out += `_Find it:_ ${q.lessonRef.title}\n`;
    out += `\n`;
  });
  return out;
}

async function exportCourse(id, prefix, { footer, glossary }) {
  const { data: course } = await db.from('courses').select('title,slug').eq('id', id).maybeSingle();
  if (!course) { console.error(`course ${id} not found`); return 0; }
  const label = course.title || prefix;
  const ftr = footer || `${label} · Centenarian Academy`;
  const { data: mods } = await db.from('course_modules').select('id,title,order').eq('course_id', id).order('order');
  const { data: lessons } = await db.from('lessons').select('id,title,lesson_type,module_id,order,text_content,quiz_content').eq('course_id', id);
  const { data: assigns } = await db.from('assignments').select('id,title,description,module_id').eq('course_id', id);
  lessons.sort((a, b) => a.order - b.order);
  const byMod = {};
  for (const m of mods) byMod[m.id] = { mod: m, lessons: [], quizzes: [], assigns: [] };
  for (const l of lessons) { if (byMod[l.module_id]) (l.lesson_type === 'quiz' ? byMod[l.module_id].quizzes : byMod[l.module_id].lessons).push(l); }
  for (const a of assigns || []) if (byMod[a.module_id]) byMod[a.module_id].assigns.push(a);

  let count = 0;
  const rows = [];
  for (const m of mods) {
    const g = byMod[m.id];
    const code = 'M' + pad2(m.order);
    const base = `${prefix}-${code}-${moduleSlug(m.title)}`;
    const tags = [];
    if (g.lessons.length) {
      let md = `# ${prefix} ${code}: ${m.title}\n\n_${label}_\n\n${g.lessons.length} lessons.\n`;
      for (const l of g.lessons) md += `\n---\n\n## ${l.title}\n\n${(l.text_content || '').trim()}\n`;
      writeFile(`${base}-SCRIPT`, md, ftr); count++; tags.push('SCRIPT');
    }
    if (g.quizzes.length) {
      let md = `# ${prefix} ${code} Quiz: ${m.title}\n\n_${label}_\n`;
      for (const q of g.quizzes) md += `\n${quizSection(q)}`;
      writeFile(`${base}-QUIZ`, md, ftr); count++; tags.push('QUIZ');
    }
    if (g.assigns.length) {
      let md = `# ${prefix} ${code} Assignment: ${m.title}\n\n_${label}_\n`;
      for (const a of g.assigns) md += `\n## ${a.title}\n\n${(a.description || '').trim()}\n`;
      writeFile(`${base}-ASSIGNMENT`, md, ftr); count++; tags.push('ASSIGN');
    }
    rows.push(`| ${code} | ${m.title} | ${tags.join(', ') || '-'} |`);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  writeFile(`${prefix}-00-INDEX`, `# ${prefix} — ${label}\n\nCourse id: ${id}\nModules: ${mods.length} | Lessons: ${lessons.length}\nExported from the live course on ${stamp}.\n\n| Code | Module | Files |\n|---|---|---|\n${rows.join('\n')}\n`, ftr); count++;

  if (glossary) {
    const { data: terms } = await db.from('course_glossary_terms').select('term,definition').eq('course_id', id).order('term');
    if (terms?.length) {
      let g = `# ${prefix} Glossary: ${label}\n\n_${label}_\n\n${terms.length} terms.\n\n`;
      for (const t of terms) g += `**${t.term}** — ${(t.definition || '').trim()}\n\n`;
      writeFile(`${prefix}-99-GLOSSARY`, g, ftr); count++;
    }
  }
  console.log(`exported ${prefix}: ${count} files (x2 for pdf) from "${label}"`);
  return count;
}

// ---- run ----
fs.mkdirSync(OUT, { recursive: true });
const { data: main } = await db.from('courses').select('slug').eq('id', courseId).maybeSingle();
const prefix = opt('--prefix') || (main?.slug ? main.slug.split('-')[0].toUpperCase() : 'COURSE');
const footer = opt('--footer');

if (doClean) {
  const re = new RegExp(`^${prefix}-.*\\.(md|pdf)$`);
  let removed = 0;
  for (const f of fs.readdirSync(OUT)) if (re.test(f)) { fs.unlinkSync(path.join(OUT, f)); removed++; }
  console.log(`cleaned ${removed} existing ${prefix}-* files`);
}

await exportCourse(courseId, prefix, { footer, glossary: includeGlossary });
if (TEACHER_ID) await exportCourse(TEACHER_ID, `${prefix}-TEACHER`, { footer, glossary: false });
console.log('done. output dir: ' + OUT);
