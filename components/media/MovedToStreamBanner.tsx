// components/media/MovedToStreamBanner.tsx
// Stage 1 notice on every /dashboard/media page: Media moved to Stream.WitUS, the list
// is read-only here, and the export is the way to take it along.

import { ArrowRightLeft, Download, ExternalLink } from 'lucide-react';
import { MEDIA_EXPORT_PATH, STREAM_WITUS_MEDIA_URL } from '@/lib/media/stream-handoff';

export default function MovedToStreamBanner() {
  return (
    <section
      aria-labelledby="media-moved-heading"
      className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <ArrowRightLeft className="w-5 h-5 text-fuchsia-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 id="media-moved-heading" className="text-base font-semibold text-fuchsia-900">
              Media is moving to Stream.WitUS
            </h2>
            <p className="mt-1 text-sm text-gray-700">
              Your media list is read-only here. Export it as a CSV file, then import that
              file in Stream.WitUS.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={MEDIA_EXPORT_PATH}
              download
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Export my media (CSV)
            </a>
            <a
              href={STREAM_WITUS_MEDIA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-sky-700 bg-white px-4 text-sm font-semibold text-sky-700 hover:bg-sky-50 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            >
              Go to Stream.WitUS
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>

          <p className="text-xs text-gray-600">
            On Stream.WitUS, open your media page and choose Import CSV. Importing the same file
            again skips items you already have. The file includes titles, types, status, ratings,
            dates, genres, tags, links, progress, season and episode numbers, favorites,
            visibility, and each item&apos;s notes field. Categories and entries in an item&apos;s
            Notes section are not included.
          </p>
        </div>
      </div>
    </section>
  );
}
