// app/api/academy/document-proxy/route.ts
// Same-origin proxy for lesson document PDFs.
//
// Why this exists: Cloudinary's /raw/upload/ endpoint serves files with
// `Content-Disposition: attachment` by default. A direct tab opens that
// fine (browser PDF viewer downloads + renders), but an <iframe>
// interprets attachment disposition as "don't render inline" and
// typically falls back to a blank frame or the browser's generic 404
// error page. Same story for any Cloudinary PDF stored under
// /image/upload/ on accounts where "Allow delivery of PDF" is off — the
// direct URL returns 401, and the iframe surfaces that as a 404-ish
// failure.
//
// The proxy fetches the upstream file server-side and re-serves it with
// `Content-Disposition: inline`, so <iframe src="/api/...proxy?url=…">
// just works. Upstream 4xx errors pass through with a readable
// JSON body so the viewer can show "Document link is broken — ask your
// teacher to re-upload" instead of a blank frame.

import { NextRequest, NextResponse } from 'next/server';

// Only accept URLs on these hosts. Lets us lean on Next's same-origin
// guarantees without becoming an open proxy for arbitrary URLs.
const ALLOWED_HOSTS = new Set([
  'res.cloudinary.com',
  'cloudinary.com',
]);

export async function GET(request: NextRequest) {
  const targetRaw = request.nextUrl.searchParams.get('url');
  if (!targetRaw) {
    return NextResponse.json({ error: 'url query param required' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(targetRaw);
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 400 });
  }

  let upstream: Response;
  try {
    // Cache upstream at the edge for a minute — students hitting the
    // same doc repeatedly don't each trigger a Cloudinary fetch.
    upstream = await fetch(target.toString(), {
      next: { revalidate: 60 },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'upstream fetch failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: `Upstream returned ${upstream.status}`,
        upstream_status: upstream.status,
        hint: upstream.status === 401 || upstream.status === 403
          ? 'The Cloudinary asset is private or PDF delivery is disabled. Re-upload through the teacher editor (PDFs now route to /raw/upload) or enable "Allow delivery of PDF and ZIP files" in the Cloudinary account settings.'
          : undefined,
      },
      { status: upstream.status },
    );
  }

  // Force inline rendering. Preserve the upstream Content-Type so
  // browsers pick the right viewer; default to application/pdf.
  const contentType = upstream.headers.get('content-type') || 'application/pdf';
  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': 'inline',
    // Allow same-origin iframes. Without explicit X-Frame-Options the
    // default browser behavior lets same-origin embedding work.
    'Cache-Control': 'public, max-age=60, s-maxage=300',
  });

  const contentLength = upstream.headers.get('content-length');
  if (contentLength) headers.set('Content-Length', contentLength);

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
