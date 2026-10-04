// app/api/finance/import/batches/route.ts
// GET: the signed-in user's statement imports, newest first.
//
// Query: ?limit=50 (1-200), ?account_id=<uuid> to list one account's imports.
// 200 -> { batches: [{ id, account_id, source, file_name, preset, row_count,
//          inserted_count, linked_count, duplicate_count, invalid_count,
//          status: 'committed' | 'undone', undone_at, created_at,
//          financial_accounts: { id, name, institution_name, last_four } | null }] }
// 503 -> { error: "... Run migration 203 first ...", code: 'migration_required' }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { listBatches } from '@/lib/finance/csv-import/service';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  try {
    const batches = await listBatches(supabase, user.id, {
      limit: Number(params.get('limit')) || undefined,
      accountId: params.get('account_id'),
    });
    return NextResponse.json({ batches });
  } catch (error) {
    return importErrorResponse(error);
  }
}
