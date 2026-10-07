// app/api/finance/review/route.ts
// The finance Review page: everything waiting for a decision, worked out from
// saved data (lib/finance/review).
//
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (both optional)
//     &limit=25 (1-100, the page size of every section)
//     &transfers_offset= &payments_offset= &matches_offset= &uncategorized_offset=
//   200 -> { counts: { transfers, payments, matches, uncategorized, drafts, total },
//            sections: { transfers, payments, matches, uncategorized }: { items, total, offset },
//            accounts, drafts (null before migration 219), saved_answers_available,
//            truncated, window }
//   503 -> { code: 'transfers_not_migrated' } before migration 202
//
// POST { action, ... }, every id checked to be the user's:
//   link_pairs      { pairs: [{ from_id, to_id }] }              -> { linked, failed }
//   link_payments   { items: [{ transaction_id, account_id }], record_missing? }
//                                                                -> { linked, recorded, unmatched, failed }
//   merge_matches   { pairs: [{ imported_id, entry_id }] }       -> { merged, failed }
//   dismiss         { items: [{ section, transaction_id, other_transaction_id? }] } -> { dismissed }
//   restore         { sections: ['transfer_pair' | 'one_sided_payment' | 'possible_match'] } -> { restored }
//   categorize      { ids: [...], category_id: uuid | null }     -> { updated }
//   Up to 200 items per request (2,000 for dismiss). dismiss and restore answer
//   503 "Run migration 219 first" until it is applied.
//   categorize and merge_matches move the automatic life-area tag with the
//   category (one category tree, migration 223).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ImportError } from '@/lib/finance/csv-import/errors';
import { importErrorResponse, readJson, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import {
  categorizeRows,
  dismissSuggestions,
  linkPayments,
  linkTransferPairs,
  mergeMatches,
  restoreDismissals,
} from '@/lib/finance/review/actions';
import { buildReview, readRange } from '@/lib/finance/review/server';
import { syncAutoLifeAreas } from '@/lib/categories/life-areas';

/** The string ids in a list from the request (anything else is left out). */
function stringIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const offset = (name: string) => Number(params.get(`${name}_offset`)) || 0;
  try {
    const review = await buildReview(supabase, user.id, {
      range: readRange(params.get('from'), params.get('to')),
      limit: Number(params.get('limit')) || undefined,
      offsets: {
        transfers: offset('transfers'),
        payments: offset('payments'),
        matches: offset('matches'),
        uncategorized: offset('uncategorized'),
      },
    });
    return NextResponse.json(review);
  } catch (error) {
    return importErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const body = await readJson(request);
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  try {
    switch (fields.action) {
      case 'link_pairs':
        return NextResponse.json(await linkTransferPairs(supabase, user.id, fields.pairs));
      case 'link_payments':
        return NextResponse.json(
          await linkPayments(supabase, user.id, fields.items, { recordMissing: fields.record_missing !== false }),
        );
      case 'merge_matches': {
        const result = await mergeMatches(supabase, user.id, fields.pairs);
        // The kept entry may take the imported row's category: its life area follows.
        const entryIds = Array.isArray(fields.pairs)
          ? stringIds(fields.pairs.map((pair) => (typeof pair === 'object' && pair !== null ? (pair as Record<string, unknown>).entry_id : null)))
          : [];
        if (result.merged > 0) await syncAutoLifeAreas(supabase, user.id, entryIds);
        return NextResponse.json(result);
      }
      case 'dismiss':
        return NextResponse.json(await dismissSuggestions(supabase, user.id, fields.items));
      case 'restore':
        return NextResponse.json(await restoreDismissals(supabase, user.id, fields.sections));
      case 'categorize': {
        const result = await categorizeRows(supabase, user.id, fields.ids, fields.category_id ?? null);
        await syncAutoLifeAreas(supabase, user.id, stringIds(fields.ids));
        return NextResponse.json(result);
      }
      default:
        throw new ImportError(
          400,
          'bad_request',
          'action must be link_pairs, link_payments, merge_matches, dismiss, restore or categorize.',
        );
    }
  } catch (error) {
    return importErrorResponse(error);
  }
}
