// lib/finance/reconciliation/request.ts
// Shared bits of the reconciliation routes (app/api/finance/reconciliations/*):
// turning a ReconcileRuleError into a response. "Today" and the FX fields of an
// adjustment work exactly like a cash count's (lib/finance/cash/request.ts).

import { NextResponse } from 'next/server';
import { ReconcileRuleError } from './logic';

export { fxForUser, resolveToday } from '@/lib/finance/cash/request';

export function reconcileErrorResponse(err: unknown): NextResponse {
  if (err instanceof ReconcileRuleError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  throw err;
}
