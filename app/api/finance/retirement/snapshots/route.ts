// app/api/finance/retirement/snapshots/route.ts
// POST: record an account's balance on a date, entered by hand.
//   { account_id, as_of: 'YYYY-MM-DD', balance, contributions_ytd?, note? }
// One balance per account per date: a second entry for the same date replaces the first.
// (A statement import can call upsertSnapshot() with source 'statement' later.)

import { NextRequest, NextResponse } from 'next/server';
import { parseSnapshotInput, upsertSnapshot } from '@/lib/finance/retirement/server';
import { errorResponse, readJson, sessionUser, unauthorized } from '@/lib/finance/retirement/request';

export async function POST(request: NextRequest) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    const snapshot = await upsertSnapshot(db, userId, parseSnapshotInput(await readJson(request)));
    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'api/finance/retirement/snapshots');
  }
}
