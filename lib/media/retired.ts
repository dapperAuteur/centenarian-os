// lib/media/retired.ts
// Stage 1 of the CentOS decomposition: the Media tracker moved to Stream.WitUS.
// Media is read-only here. Write endpoints under /api/media (and the podcast episode
// endpoints under /api/podcasts that belong to the same module) answer 410 Gone via
// mediaRetiredResponse(). GET endpoints and /api/media/export keep working so users
// can still see and export their list. Pages and tables stay until a later stage.

import { NextResponse } from 'next/server';

/** Stream.WitUS origin, as listed in components/ui/SiteFooter.tsx and the WitUS product registry. */
export const STREAM_WITUS_URL = 'https://stream.witus.online';

/**
 * Stream.WitUS media tracker. The path comes from Stream's own code
 * (src/app/dashboard/media/page.tsx; signed-out visitors are sent to /signin by
 * src/app/dashboard/layout.tsx). Stream has no CSV-upload page yet, only the
 * POST /api/media/import endpoint, so this points at the tracker home. Point it at
 * the import page once Stream ships one.
 */
export const STREAM_WITUS_MEDIA_URL = `${STREAM_WITUS_URL}/dashboard/media`;

export const MEDIA_EXPORT_PATH = '/api/media/export';

export const MEDIA_RETIRED_MESSAGE =
  'Media has moved to Stream.WitUS and is read-only in CentenarianOS. ' +
  'Export your list as a CSV from the Media page, then import it in Stream.WitUS.';

/** 410 Gone for any Media write. The `error` key is what the existing clients display. */
export function mediaRetiredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: MEDIA_RETIRED_MESSAGE,
      moved_to: STREAM_WITUS_MEDIA_URL,
      export_url: MEDIA_EXPORT_PATH,
    },
    { status: 410 },
  );
}
