// app/api/finance/review/dismissals/route.ts
// GET: the transfer suggestions the user turned down ("Not a transfer"), as
// the Possible transfers panel names them: "pair:<from>:<to>" and "one:<id>".
// 200 -> { keys: string[], available: true }
// Before migration 219 -> 200 { keys: [], available: false }: the panel keeps
// using the browser's own list until then.
//
// Saving and forgetting answers: POST /api/finance/review with action
// dismiss / restore.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ImportError } from '@/lib/finance/csv-import/errors';
import { importErrorResponse, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { listDismissals } from '@/lib/finance/review/actions';
import { REVIEW_MIGRATION_CODE } from '@/lib/finance/review/schema';
import { dismissalToPanelKey } from '@/lib/finance/review/sections';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    const items = await listDismissals(supabase, user.id, ['transfer_pair', 'one_sided_payment']);
    const keys = items.map(dismissalToPanelKey).filter((key): key is string => key !== null);
    return NextResponse.json({ keys, available: true });
  } catch (error) {
    if (error instanceof ImportError && error.code === REVIEW_MIGRATION_CODE) {
      return NextResponse.json({ keys: [], available: false });
    }
    return importErrorResponse(error);
  }
}
