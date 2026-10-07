// app/api/finance/review/summary/route.ts
// GET: how many things wait on the finance Review page, for the badge on the
// Finance dashboard.
// 200 -> { transfers, payments, matches, uncategorized, drafts, total }
// A database without the transfer columns (before migration 202) answers 503;
// the badge then shows nothing.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { reviewCounts } from '@/lib/finance/review/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    return NextResponse.json(await reviewCounts(supabase, user.id));
  } catch (error) {
    return importErrorResponse(error);
  }
}
