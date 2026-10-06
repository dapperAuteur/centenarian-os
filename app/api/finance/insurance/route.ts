// app/api/finance/insurance/route.ts
// GET ?today=YYYY-MM-DD: life insurance policies with premium payments matched from transactions
// (paid to date, this year, next due and whether it is covered), term-end status, totals
// (coverage, permanent-policy cash value, yearly premiums) and the categories a premium can link to.
// Before migration 215: { ready: false, ... }.
// POST: add a policy.
//   { insurer, kind?, policy_last_four?, currency?, coverage_amount?, premium_amount?,
//     premium_frequency?, start_date?, term_end_date?, cash_value?, cash_value_as_of?,
//     beneficiaries?, premium_category_id?, premium_vendor?, premium_tasks?, is_active?, notes? }
// Rules: lib/finance/insurance/logic.ts.

import { NextRequest, NextResponse } from 'next/server';
import { createPolicy, loadInsuranceOverview, parsePolicyInput } from '@/lib/finance/insurance/server';
import { errorResponse, readJson, resolveToday, sessionUser, unauthorized } from '@/lib/finance/retirement/request';

export async function GET(request: NextRequest) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    return NextResponse.json(await loadInsuranceOverview(db, userId, resolveToday(request.nextUrl.searchParams.get('today'))));
  } catch (err) {
    return errorResponse(err, 'api/finance/insurance');
  }
}

export async function POST(request: NextRequest) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    const policy = await createPolicy(db, userId, parsePolicyInput(await readJson(request), false));
    return NextResponse.json({ policy }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'api/finance/insurance');
  }
}
