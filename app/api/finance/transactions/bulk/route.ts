// app/api/finance/transactions/bulk/route.ts
// POST: apply one batch (at most 200 ids) of a bulk edit to the caller's transactions.
//
// Body (every change optional, at least one required):
//   { ids,
//     updates?: { category_id?, brand_id?, vendor?, type? },   '' or null clears category, brand, vendor
//     life_category_id?, remove_life_category_id?,            add / remove a life category
//     tags_add?: string[], tags_remove?: string[],
//     transfer?: 'unlink',                                     unlinks both sides of each selected transfer
//     remember?: true, remember_skip?: string[],               "Remember for future imports" (learned category)
//     operation?: { id?, summary? } }                          record for undo; later batches pass the id
//
// Every id is checked as the caller's own (others count as not_found and are never written), and
// every reference must be the caller's own (else 400, nothing written). The type never changes on
// one side of a transfer (type_skipped). Rules: lib/finance/bulk-edit/logic.ts; writes:
// lib/finance/bulk-edit/server.ts. Undo: ./undo/route.ts (migration 220).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { applyBulkEdit } from '@/lib/finance/bulk-edit/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const result = await applyBulkEdit(getServiceDb(), user.id, body);
  return NextResponse.json(result.body, { status: result.status });
}
