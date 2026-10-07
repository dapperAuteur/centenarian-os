// app/api/finance/import/drafts/[id]/commit/route.ts
// POST: finish a saved statement import, without its file.
//
// Body: { actions?: [{ row, action?, type?, category_id?, transfer_account_id?, record_missing? }],
//         confirm_unreconciled?: boolean }   (the same as POST /api/finance/import)
// The saved rows are planned again against current data, the actions are
// applied by row number, the rows are committed as one import batch (so Undo
// works as for any import), a PDF's statement summary is saved, and the draft
// is deleted.
//
// 200 -> { batchId, inserted, linked, duplicates, invalid, skipped, rejected,
//          transfers?, statementSaved?, statementError?, draftDeleted, imported }
// 404 -> not the user's, or imported, discarded or expired
// 409 -> 'reconciliation_unconfirmed' for a PDF that doesn't add up, unconfirmed

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, readJson, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { commitDraft } from '@/lib/finance/import-drafts/drafts';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    const result = await commitDraft(supabase, user.id, id, await readJson(request));
    return NextResponse.json({ ...result, imported: result.inserted + result.linked });
  } catch (error) {
    return importErrorResponse(error);
  }
}
