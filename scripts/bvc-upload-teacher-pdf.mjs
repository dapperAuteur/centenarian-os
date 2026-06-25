#!/usr/bin/env node
// scripts/bvc-upload-teacher-pdf.mjs <episode-slug>
//
// Renders plans/BVC/ver1/<slug>/teacher-resources.md to a PDF (Markdown -> HTML via
// marked -> PDF via headless Chrome) and uploads it to Cloudinary (unsigned raw
// upload, the same pattern as scripts/ces-upload-pdf-cloudinary.mjs). Prints the
// secure_url so it can be attached to the course documents.
//
// Run: node --env-file=.env.local scripts/bvc-upload-teacher-pdf.mjs coffee

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { marked } from 'marked';

const slug = process.argv[2] || 'coffee';
const ROOT = '/Users/bam/Code_NOiCloud/ai-builds/gemini/centenarian-os';
const SRC = path.join(ROOT, 'plans/BVC/ver1', slug, 'teacher-resources.md');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const baseFolder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'centenarian';
if (!cloud || !preset) { console.error('Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / _UPLOAD_PRESET'); process.exit(1); }
if (!fs.existsSync(SRC)) { console.error('No teacher-resources.md at', SRC); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bvc-teacher-'));
const htmlPath = path.join(tmp, `${slug}-teacher.html`);
const pdfPath = path.join(tmp, `bvc-${slug}-teacher-resources.pdf`);

const bodyHtml = marked.parse(fs.readFileSync(SRC, 'utf8'));
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:46rem;margin:2rem auto;line-height:1.5;color:#111;padding:0 1.5rem}
h1{font-size:1.7rem;border-bottom:2px solid #c026d3;padding-bottom:.3rem}
h2{font-size:1.25rem;margin-top:1.6rem;color:#0369a1}
h3{font-size:1.05rem;margin-top:1.1rem}
table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:.86rem}
th,td{border:1px solid #ccc;padding:.4rem .5rem;text-align:left;vertical-align:top}
th{background:#f3f4f6}
code{background:#f3f4f6;padding:.1rem .3rem;border-radius:3px}
</style></head><body>${bodyHtml}</body></html>`;
fs.writeFileSync(htmlPath, html);

console.log('Rendering PDF with headless Chrome...');
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`], { stdio: 'pipe' });
const size = fs.statSync(pdfPath).size;
console.log(`PDF: ${pdfPath} (${Math.round(size / 1024)} KB)`);

console.log('Uploading to Cloudinary (raw)...');
const fd = new FormData();
fd.append('file', new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' }), path.basename(pdfPath));
fd.append('upload_preset', preset);
fd.append('folder', `${baseFolder}/bvc/${slug}`);
const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/raw/upload`, { method: 'POST', body: fd });
const j = await res.json();
if (!res.ok) { console.error('Cloudinary error:', JSON.stringify(j).slice(0, 300)); process.exit(1); }
console.log('\nsecure_url:', j.secure_url);
