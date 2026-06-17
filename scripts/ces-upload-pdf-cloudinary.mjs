// scripts/upload-pdf-cloudinary.mjs
// Uploads PDF lead magnets to Cloudinary via the unsigned upload preset, using the
// RAW endpoint (PDFs are raw assets; the signed key may lack image upload rights).
// Mirrors the unsigned-upload pattern in app/api/ocr/scan/route.ts. Writes a manifest
// mapping basename -> secure_url for attaching to lesson documents arrays.
//
// Usage: node --env-file=.env.local scripts/upload-pdf-cloudinary.mjs <file.pdf|dir> [more...] [--folder sub] [--out <manifest.json>]

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const folderIdx = args.indexOf('--folder');
const SUBFOLDER = folderIdx >= 0 ? args[folderIdx + 1] : 'ces';
const outIdx = args.indexOf('--out');
const MANIFEST = outIdx >= 0 ? args[outIdx + 1] : 'docs/ces-curriculum/academy-import/resources/pdf/_uploads.json';
const inputs = args.filter((a, i) => !a.startsWith('--') && !(folderIdx >= 0 && i === folderIdx + 1) && !(outIdx >= 0 && i === outIdx + 1));

const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const baseFolder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'centenarian';
if (!cloud || !preset) { console.error('Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET'); process.exit(1); }

function collect(list) {
  const files = [];
  for (const p of list) {
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) { if (f.endsWith('.pdf')) files.push(path.join(p, f)); }
    else if (p.endsWith('.pdf')) files.push(p);
  }
  return files;
}

async function uploadOne(file) {
  const buf = fs.readFileSync(file);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'application/pdf' }), path.basename(file));
  fd.append('upload_preset', preset);
  fd.append('folder', `${baseFolder}/${SUBFOLDER}`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/raw/upload`, { method: 'POST', body: fd });
  const json = await res.json();
  if (!res.ok || !json.secure_url) throw new Error(`${file}: ${json.error?.message || res.status}`);
  return { file: path.basename(file), secure_url: json.secure_url, public_id: json.public_id, bytes: json.bytes };
}

async function main() {
  const files = collect(inputs);
  if (!files.length) { console.error('No .pdf inputs found.'); process.exit(1); }
  const manifest = {};
  for (const f of files) {
    try { const r = await uploadOne(f); manifest[r.file] = r.secure_url; console.log('uploaded', r.file, '->', r.secure_url); }
    catch (e) { console.error('FAILED', e.message); }
  }
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nmanifest -> ${MANIFEST} (${Object.keys(manifest).length} uploaded)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
