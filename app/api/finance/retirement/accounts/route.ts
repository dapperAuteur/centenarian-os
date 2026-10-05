// app/api/finance/retirement/accounts/route.ts
// POST: add an investment account.
//   { name, kind?, institution?, last_four?, currency?, contribution_type?, contribution_amount?,
//     contribution_percent?, contribution_frequency?, annual_pay?, match_rate_percent?,
//     match_limit_percent?, match_annual_cap?, expected_annual_return?, is_active?, notes? }
// 503 until migration 215 is applied.

import { NextRequest, NextResponse } from 'next/server';
import { createAccount, parseAccountInput } from '@/lib/finance/retirement/server';
import { errorResponse, readJson, sessionUser, unauthorized } from '@/lib/finance/retirement/request';

export async function POST(request: NextRequest) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    const account = await createAccount(db, userId, parseAccountInput(await readJson(request), false));
    return NextResponse.json({ account }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'api/finance/retirement/accounts');
  }
}
