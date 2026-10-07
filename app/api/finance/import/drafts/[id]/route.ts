// app/api/finance/import/drafts/[id]/route.ts
// One saved statement import.
//
// PATCH: save the person's choices (the review step autosaves these).
//   Body: { decisions: { [rowNumber]: { action?, type?, categoryId?, cardKind?, transferAccountId? } },
//           options: { recordMissing?, confirmUnreconciled? } }
//   Rows are never accepted here: they were saved by the server from the file.
//   200 -> { id, updated_at, expires_at }   (expires 30 days after this save)
//   404 -> not the user's, or imported, discarded or expired
//
// DELETE: discard it.
//   200 -> { deleted: boolean }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, readJson, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { deleteDraft, updateDraftChoices } from '@/lib/finance/import-drafts/drafts';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    return NextResponse.json(await updateDraftChoices(supabase, user.id, id, await readJson(request)));
  } catch (error) {
    return importErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    return NextResponse.json({ deleted: await deleteDraft(supabase, user.id, id) });
  } catch (error) {
    return importErrorResponse(error);
  }
}
