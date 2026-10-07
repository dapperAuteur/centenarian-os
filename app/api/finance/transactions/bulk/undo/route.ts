// app/api/finance/transactions/bulk/undo/route.ts
// Undo for bulk edits (migration 220).
//
// GET  -> { available, operation: { id, summary, row_count, status, created_at } | null }
//         The most recent bulk edit that can still be undone. Before migration 220:
//         { available: false, code: 'bulk_edit_not_migrated', message } ("Run migration 220 first").
// POST { operation_id } -> { restored, skipped: { changed, missing, pair_changed, failed }, done }
//         Puts back up to 400 rows per call; the client repeats while done is false. A row is put
//         back only when it still holds every value the edit wrote, and an unlinked transfer is
//         linked again only with both sides. See lib/finance/bulk-edit/server.ts.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { latestOperation, undoOperation } from '@/lib/finance/bulk-edit/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await latestOperation(getServiceDb(), user.id);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const result = await undoOperation(getServiceDb(), user.id, body?.operation_id);
  return NextResponse.json(result.body, { status: result.status });
}
