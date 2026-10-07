// app/api/finance/import/batches/[id]/rows/route.ts
// Edit or delete rows of one past statement import (Import history).
// Only rows of THIS import, of the signed-in user, are touched.
//
// PATCH { ids: [...], changes: { category_id?: uuid | null, type?: 'expense' | 'income',
//                                 vendor?: string | null, description?: string } }
//   Up to 200 rows. The category must be the user's own (else 400). A type
//   change on one side of a transfer is refused for that row.
//   200 -> { updated, skipped: [{ id, reason }] }
//
// DELETE { ids: [...] }
//   Deletes rows the import added. Entries the person made that the import
//   only linked are skipped (open them to delete them). A deleted row's
//   transfer is taken apart the way Undo does it.
//   200 -> { deleted, counterEntriesRemoved, skipped: [{ id, reason }] }
//
// 404 -> not the user's import. Edited rows are kept by a later Undo.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, readJson, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { deleteBatchRows, editBatchRows } from '@/lib/finance/import-history/batch-rows';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    return NextResponse.json(await editBatchRows(supabase, user.id, id, await readJson(request)));
  } catch (error) {
    return importErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    return NextResponse.json(await deleteBatchRows(supabase, user.id, id, await readJson(request)));
  } catch (error) {
    return importErrorResponse(error);
  }
}
