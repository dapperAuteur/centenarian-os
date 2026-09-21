// app/api/media/import-url/route.ts
// Was: POST a media URL (IMDB, Goodreads, etc.) to extract metadata that pre-fills the
// add-media form. Adding media is retired now that Media moved to Stream.WitUS, so this
// returns 410 Gone. See lib/media/retired.ts.

import { mediaRetiredResponse } from '@/lib/media/retired';

export function POST() {
  return mediaRetiredResponse();
}
