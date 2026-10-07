// app/api/finance/import/batches/[id]/route.ts
// GET: one statement import and a page of its rows, for Import history.
//
// Query: ?offset=0&limit=100 (1-200). Rows are in statement order (date, oldest first).
// 200 -> { batch: { id, account_id, source, file_name, preset, row_count, inserted_count,
//                   linked_count, duplicate_count, invalid_count, status, undone_at,
//                   created_at, financial_accounts },
//          rows: [{ id, transaction_date, amount, type, description, vendor, category_id,
//                   account_id, source, transfer_group_id, transfer_partner, edited }],
//          total, offset }
// 404 -> not the user's import.
// 503 -> "Run migration 203 first" before the import tables exist.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { listBatchRows } from '@/lib/finance/import-history/batch-rows';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const query = request.nextUrl.searchParams;
  try {
    return NextResponse.json(
      await listBatchRows(supabase, user.id, id, {
        offset: Number(query.get('offset')) || 0,
        limit: Number(query.get('limit')) || undefined,
      }),
    );
  } catch (error) {
    return importErrorResponse(error);
  }
}
