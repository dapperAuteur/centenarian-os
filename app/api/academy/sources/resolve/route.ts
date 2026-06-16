// app/api/academy/sources/resolve/route.ts
// POST { doi?: string, url?: string } -> a verified citation (APA + in-text + link + OA PDF),
// resolved against Crossref, with an open-access PDF link from Unpaywall when available.
// This is the keystone of the claim-verification flow: a teacher pastes a DOI or URL and the
// citation fills in. Auth: any logged-in user.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAILTO = process.env.UNPAYWALL_EMAIL || process.env.ADMIN_EMAIL || 'tools@awews.com';

function extractDoi(s: string): string | null {
  const m = String(s || '').match(/10\.\d{4,}\/[^\s"<>]+/i);
  return m ? m[0].replace(/[).,;]+$/, '') : null;
}
function initials(given?: string): string {
  return String(given || '').split(/[\s.-]+/).filter(Boolean).map((g) => g[0].toUpperCase() + '.').join(' ');
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function apaAuthors(authors: any[]): string {
  const list = (authors || []).map((a) => (a.family ? `${a.family}, ${initials(a.given)}`.trim() : a.name)).filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length <= 20) return list.slice(0, -1).join(', ') + ', & ' + list[list.length - 1];
  return list.slice(0, 19).join(', ') + ', ... ' + list[list.length - 1];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inText(authors: any[], year: string | number): string {
  const fam = (authors || []).map((a) => a.family).filter(Boolean);
  if (!fam.length) return `(Anonymous, ${year})`;
  if (fam.length === 1) return `(${fam[0]}, ${year})`;
  if (fam.length === 2) return `(${fam[0]} & ${fam[1]}, ${year})`;
  return `(${fam[0]} et al., ${year})`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const rawDoi: string | undefined = body.doi;
  const url: string | undefined = body.url;
  let doi = rawDoi ? extractDoi(rawDoi) : null;
  if (!doi && url) doi = extractDoi(url);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let m: any = null;
  try {
    if (doi) {
      const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${MAILTO}`, { headers: { 'User-Agent': 'centenarian-academy/1.0' } });
      if (r.ok) m = (await r.json()).message;
    } else if (url || rawDoi) {
      const q = encodeURIComponent(url || rawDoi || '');
      const r = await fetch(`https://api.crossref.org/works?rows=1&mailto=${MAILTO}&query.bibliographic=${q}`, { headers: { 'User-Agent': 'centenarian-academy/1.0' } });
      if (r.ok) { const items = (await r.json()).message?.items; m = items && items[0]; if (m) doi = m.DOI; }
    }
  } catch {
    return NextResponse.json({ error: 'Lookup service unavailable. Try again.' }, { status: 502 });
  }
  if (!m) return NextResponse.json({ error: 'Could not resolve. Paste a DOI, or a more specific title/reference.' }, { status: 404 });

  const year = (((m.published || m['published-print'] || m['published-online'] || {})['date-parts'] || [['']])[0][0]) || '';
  const title = (m.title || [''])[0] || '';
  const journal = (m['container-title'] || [''])[0] || '';
  const vol = m.volume || ''; const iss = m.issue || ''; const pg = m.page || '';
  let apa = `${apaAuthors(m.author)} (${year}). ${title}. ${journal}`;
  if (vol) apa += `, ${vol}`; if (iss) apa += `(${iss})`; if (pg) apa += `, ${pg}`;
  if (doi) apa += `. https://doi.org/${doi}`;
  apa = apa.replace(/\s+/g, ' ').trim();

  let pdfUrl: string | null = null;
  if (doi) {
    try {
      const up = await (await fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${MAILTO}`)).json();
      pdfUrl = (up && up.best_oa_location && up.best_oa_location.url_for_pdf) || null;
    } catch { /* optional */ }
  }

  return NextResponse.json({
    inText: inText(m.author, year),
    apa,
    doi: doi || null,
    url: doi ? `https://doi.org/${doi}` : (url || null),
    pdfUrl,
    title,
    journal,
    year: String(year),
  });
}
