// app/api/media/creators/[id]/route.ts
// Was: PATCH (rename) / DELETE a saved creator.
// Media moved to Stream.WitUS, so these writes are retired (410 Gone). See lib/media/retired.ts.

import { mediaRetiredResponse } from '@/lib/media/retired';

export function PATCH() {
  return mediaRetiredResponse();
}

export function DELETE() {
  return mediaRetiredResponse();
}
