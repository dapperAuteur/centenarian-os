// app/api/media/platforms/[id]/route.ts
// Was: PATCH (rename) / DELETE a saved platform.
// Media moved to Stream.WitUS, so these writes are retired (410 Gone). See lib/media/retired.ts.

import { mediaRetiredResponse } from '@/lib/media/retired';

export function PATCH() {
  return mediaRetiredResponse();
}

export function DELETE() {
  return mediaRetiredResponse();
}
