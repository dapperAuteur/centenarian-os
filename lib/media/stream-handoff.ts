// lib/media/stream-handoff.ts
// Client-safe constants for the Media -> Stream.WitUS move (Stage 1 of the CentOS
// decomposition). No imports, so both client components and API routes can use it.

/** Stream.WitUS origin, as listed in components/ui/SiteFooter.tsx and the WitUS product registry. */
export const STREAM_WITUS_URL = 'https://stream.witus.online';

/**
 * Stream.WitUS media tracker, and where users import the CSV this app exports. The
 * path comes from Stream's own code (src/app/dashboard/media/page.tsx; signed-out
 * visitors are sent to /signin by src/app/dashboard/layout.tsx). The CSV import
 * control lives on this page (added in Stream's feat/media-csv-import branch, backed
 * by its POST /api/media/import), so there is no separate import URL to point at.
 */
export const STREAM_WITUS_MEDIA_URL = `${STREAM_WITUS_URL}/dashboard/media`;

/** CentOS CSV export. Its snake_case headers are the ones Stream's importer reads. */
export const MEDIA_EXPORT_PATH = '/api/media/export';
