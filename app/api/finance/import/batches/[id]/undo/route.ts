// app/api/finance/import/batches/[id]/undo/route.ts
// POST: undo one statement import.
//
// Rows the import inserted and nobody has edited since are deleted. Rows it
// inserted that were edited afterwards are kept and listed in `kept`. Manual
// or scanned entries it only linked stay, with the link cleared. The batch is
// then marked 'undone'; undoing it again changes nothing (alreadyUndone: true).
//
// 200 -> { batchId, alreadyUndone, deleted, unlinked,
//          kept: [{ id, transaction_date, amount, description, vendor }] }
// 404 -> { error } when the import isn't the signed-in user's.
// 503 -> { error: "... Run migration 203 first ...", code: 'migration_required' }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ImportError } from '@/lib/finance/csv-import/errors';
import { importErrorResponse, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { isUuid } from '@/lib/finance/csv-import/service';
import { undoBatch } from '@/lib/finance/csv-import/undo';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  try {
    // A malformed id can't be anyone's import; answer before Postgres rejects the cast.
    if (!isUuid(id)) throw new ImportError(404, 'batch_not_found', 'That import was not found.');
    return NextResponse.json(await undoBatch(supabase, user.id, id));
  } catch (error) {
    return importErrorResponse(error);
  }
}
