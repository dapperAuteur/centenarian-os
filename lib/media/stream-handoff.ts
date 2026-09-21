// lib/media/stream-handoff.ts
// Client-safe constants for the Media -> Stream.WitUS move (Stage 1 of the CentOS
// decomposition). No imports, so both client components and API routes can use it.

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

/** CentOS CSV export. Its snake_case headers are the ones Stream's importer reads. */
export const MEDIA_EXPORT_PATH = '/api/media/export';
