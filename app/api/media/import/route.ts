// app/api/media/import/route.ts
// Was: POST bulk import of media items from parsed CSV rows.
// Media moved to Stream.WitUS, so this write is retired (410 Gone). See lib/media/retired.ts.
// The CSV that /api/media/export produces is what users now import into Stream.WitUS.

import { mediaRetiredResponse } from '@/lib/media/retired';

export function POST() {
  return mediaRetiredResponse();
}
