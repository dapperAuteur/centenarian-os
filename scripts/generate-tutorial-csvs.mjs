#!/usr/bin/env node
// scripts/generate-tutorial-csvs.mjs
// Reads content/tutorials/* markdown files and generates course-import CSVs in public/templates/

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, basename } from 'path';

const TUTORIALS_DIR = join(process.cwd(), 'content/tutorials');
const TEMPLATES_DIR = join(process.cwd(), 'public/templates');

const HEADER = 'module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content';

// Skip duplicate/copy directories and CSV-only directories
const SKIP = ['academy copy', 'teaching copy', 'ecs', 'fda'];

function csvEscape(val) {
  if (!val) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function extractTitle(content, filename) {
  // Try to extract from first # heading
  const match = content.match(/^#\s+(?:Lesson\s+\d+:\s*|Lecture\s+\d+:\s*|Course Overview:\s*)?(.+)/m);
  if (match) return match[1].trim();
  // Fallback: humanize filename
  const name = basename(filename, '.md').replace(/^\d+-/, '');
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function estimateDuration(content) {
  const words = content.split(/\s+/).length;
  const minutes = Math.max(2, Math.ceil(words / 200));
  return minutes * 60;
}

function parseModuleStructure(overviewContent) {
  // Parse "1. **Module Name** — N lessons" patterns
  const modules = [];
  const lines = overviewContent.split('\n');
  for (const line of lines) {
    const match = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*[—–-]/);
    if (match) {
      // Extract lesson count
      const countMatch = line.match(/(\d+)\s+lesson/);
      const count = countMatch ? parseInt(countMatch[1]) : 2;
      modules.push({ name: match[1].trim(), count });
    }
  }
  return modules;
}

function assignModules(lessonFiles, modules) {
  // Map each lesson index to a module based on the overview's module structure
  const assignments = [];
  let lessonIdx = 0;
  for (let m = 0; m < modules.length; m++) {
    for (let i = 0; i < modules[m].count && lessonIdx < lessonFiles.length; i++) {
      assignments.push({
        file: lessonFiles[lessonIdx],
        moduleName: modules[m].name,
        moduleOrder: m + 1,
      });
      lessonIdx++;
    }
  }
  // Any remaining lessons go into last module (or "Additional")
  while (lessonIdx < lessonFiles.length) {
    assignments.push({
      file: lessonFiles[lessonIdx],
      moduleName: modules.length > 0 ? modules[modules.length - 1].name : 'Additional',
      moduleOrder: modules.length || 1,
    });
    lessonIdx++;
  }
  return assignments;
}

async function processTutorial(dirName) {
  const dirPath = join(TUTORIALS_DIR, dirName);
  const files = await readdir(dirPath);
  const mdFiles = files.filter(f => f.endsWith('.md')).sort();

  if (mdFiles.length === 0) return null;

  // Read overview for module structure
  let modules = [];
  const overviewFile = mdFiles.find(f => f.startsWith('00-'));
  if (overviewFile) {
    const overviewContent = await readFile(join(dirPath, overviewFile), 'utf-8');
    modules = parseModuleStructure(overviewContent);
  }

  // Lesson files (skip 00-course-overview)
  const lessonFiles = mdFiles.filter(f => !f.startsWith('00-'));
  if (lessonFiles.length === 0) return null;

  // If no module structure found, use single module
  if (modules.length === 0) {
    modules = [{ name: 'Lessons', count: lessonFiles.length }];
  }

  const assignments = assignModules(lessonFiles, modules);
  const rows = [HEADER];

  for (let i = 0; i < assignments.length; i++) {
    const { file, moduleName, moduleOrder } = assignments[i];
    const content = await readFile(join(dirPath, file), 'utf-8');
    const title = extractTitle(content, file);
    const duration = estimateDuration(content);

    const row = [
      csvEscape(moduleName),       // module_title
      moduleOrder,                  // module_order
      i + 1,                       // lesson_order
      csvEscape(title),            // title
      'text',                      // lesson_type
      duration,                    // duration_seconds
      'true',                      // is_free_preview
      '',                          // content_url
      csvEscape(content),          // text_content
      'markdown',                  // content_format
      '',                          // audio_chapters
      '',                          // transcript_content
      '',                          // map_content
      '',                          // documents
      '',                          // podcast_links
      '',                          // quiz_content
    ].join(',');

    rows.push(row);
  }

  return rows.join('\n');
}

async function main() {
  const dirs = await readdir(TUTORIALS_DIR);
  let generated = 0;

  for (const dir of dirs.sort()) {
    if (SKIP.includes(dir)) {
      console.log(`  skip: ${dir} (${SKIP.includes(dir) ? 'excluded' : 'csv-only'})`);
      continue;
    }

    const dirPath = join(TUTORIALS_DIR, dir);
    // Check it's actually a directory with md files
    const files = await readdir(dirPath).catch(() => null);
    if (!files) continue;

    const hasMd = files.some(f => f.endsWith('.md'));
    if (!hasMd) {
      console.log(`  skip: ${dir} (no markdown files)`);
      continue;
    }

    const csv = await processTutorial(dir);
    if (!csv) {
      console.log(`  skip: ${dir} (no lesson files)`);
      continue;
    }

    const outFile = `tutorial-${dir}-import.csv`;
    await writeFile(join(TEMPLATES_DIR, outFile), csv, 'utf-8');
    const lineCount = csv.split('\n').length - 1; // minus header
    console.log(`  done: ${outFile} (${lineCount} lessons)`);
    generated++;
  }

  console.log(`\nGenerated ${generated} tutorial CSVs in public/templates/`);
}

main().catch(console.error);
