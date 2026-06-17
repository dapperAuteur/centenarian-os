// scripts/render-resources-pdf.mjs
// Renders resource Markdown (study plan, cheat sheet, glossary, checklist) to clean,
// typographic PDFs with jsPDF (no headless browser needed). Output is a simple,
// readable lead-magnet PDF, not a pixel-perfect web render.
//
// Usage: node scripts/render-resources-pdf.mjs <file.md|dir> [more...] --out <dir>

import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { jsPDF } from 'jspdf';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args[outIdx + 1] : 'docs/ces-curriculum/academy-import/resources/pdf';
const inputs = args.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1);

function collectMd(list) {
  const files = [];
  for (const p of list) {
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) { if (f.endsWith('.md')) files.push(path.join(p, f)); }
    else if (p.endsWith('.md')) files.push(p);
  }
  return files;
}

const MARGIN = 54, PAGE_W = 612, PAGE_H = 792, MAXW = PAGE_W - MARGIN * 2;
const flatten = (tokens) => (tokens || []).map((t) => {
  if (t.type === 'br') return '\n';
  if (t.tokens) return flatten(t.tokens);
  return t.text || t.raw || '';
}).join('');

function renderMd(md, title) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = MARGIN;
  const ensure = (h) => { if (y + h > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; } };
  const write = (text, { size = 10.5, style = 'normal', indent = 0, gap = 4, color = [20, 20, 20] } = {}) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color);
    const lh = size * 1.35;
    for (const para of String(text).split('\n')) {
      const lines = doc.splitTextToSize(para, MAXW - indent);
      for (const line of lines) { ensure(lh); doc.text(line, MARGIN + indent, y); y += lh; }
    }
    y += gap;
  };

  if (title) { write(title, { size: 20, style: 'bold', gap: 6 }); }
  for (const tok of marked.lexer(md)) {
    if (tok.type === 'heading') {
      const sizes = { 1: 18, 2: 14.5, 3: 12.5 };
      y += tok.depth <= 2 ? 8 : 4;
      write(flatten(tok.tokens), { size: sizes[tok.depth] || 11.5, style: 'bold', gap: 3, color: [10, 10, 10] });
    } else if (tok.type === 'paragraph') {
      write(flatten(tok.tokens), { size: 10.5, gap: 6 });
    } else if (tok.type === 'list') {
      for (const item of tok.items) {
        const marker = tok.ordered ? `${(tok.start || 1) + tok.items.indexOf(item)}.` : '•';
        const txt = flatten(item.tokens).replace(/\n+/g, ' ').trim();
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(20, 20, 20);
        const lh = 10.5 * 1.35;
        const lines = doc.splitTextToSize(txt, MAXW - 18);
        lines.forEach((line, i) => { ensure(lh); if (i === 0) doc.text(marker, MARGIN, y); doc.text(line, MARGIN + 18, y); y += lh; });
        y += 2;
      }
      y += 4;
    } else if (tok.type === 'hr') {
      ensure(12); doc.setDrawColor(180); doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 12;
    } else if (tok.type === 'blockquote') {
      write(flatten(tok.tokens), { size: 10.5, style: 'italic', indent: 14, gap: 6, color: [70, 70, 70] });
    } else if (tok.type === 'code') {
      write(tok.text, { size: 9, style: 'normal', indent: 10, gap: 6, color: [60, 60, 60] });
    } else if (tok.type === 'space') {
      y += 4;
    }
  }
  // footer page numbers
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Fit T. Cent 4.0  ·  NASM CES Accelerator  ·  ${p} / ${n}`, MARGIN, PAGE_H - 28); }
  return doc;
}

fs.mkdirSync(OUT, { recursive: true });
const files = collectMd(inputs);
if (!files.length) { console.error('No .md inputs found.'); process.exit(1); }
const results = [];
for (const f of files) {
  const md = fs.readFileSync(f, 'utf8');
  const h1 = (md.match(/^#\s+(.+)$/m) || [])[1];
  const doc = renderMd(md.replace(/^#\s+.+\n/, ''), h1 || path.basename(f, '.md'));
  const outFile = path.join(OUT, path.basename(f, '.md') + '.pdf');
  fs.writeFileSync(outFile, Buffer.from(doc.output('arraybuffer')));
  results.push(outFile);
  console.log('wrote', outFile);
}
console.log(JSON.stringify({ rendered: results.length, outDir: OUT }, null, 2));
