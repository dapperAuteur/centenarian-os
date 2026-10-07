// app/api/finance/import/batches/[id]/rematch/route.ts
// POST: re-run transfer matching for one statement import. Useful after the
// other account's statement was imported: the import's rows that aren't in a
// transfer are checked against every unlinked row on the person's accounts in
// the same dates. Clear pairs (high confidence) are linked now; the rest are
// left for the person on the Review page; pairs they turned down stay alone.
// Safe to run again: a second run links nothing new.
//
// 200 -> { linked, toReview, checked, failed: [{ id, reason }] }
// 404 -> not the user's import. 409 -> the import was undone.
// 503 -> before migration 202 (transfers) or 203 (imports).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { rematchBatchTransfers } from '@/lib/finance/import-history/batch-rows';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    return NextResponse.json(await rematchBatchTransfers(supabase, user.id, id));
  } catch (error) {
    return importErrorResponse(error);
  }
}
