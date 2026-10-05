// app/api/media/[id]/notes/[noteId]/route.ts
// Was: PATCH / DELETE a media note.
// Media moved to Stream.WitUS, so these writes are retired (410 Gone). See lib/media/retired.ts.

import { mediaRetiredResponse } from '@/lib/media/retired';

export function PATCH() {
  return mediaRetiredResponse();
}

export function DELETE() {
  return mediaRetiredResponse();
}
