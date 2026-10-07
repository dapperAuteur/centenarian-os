// app/api/finance/reconciliations/audit/route.ts
// GET ?today=YYYY-MM-DD: the monthly audit for the Finance dashboard card. Every active account
//      except cash accounts (counting cash is their check), with how recently it was reconciled:
//      state 'never' | 'stale' (reconciled-through date more than 30 days ago) | 'fresh', days,
//      reconciled_through, and an open reconciliation's difference. `due` lists the ones that
//      need attention (never, stale, or open), oldest first. ready: false before migration 221.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadReconcileAudit } from '@/lib/finance/reconciliation/server';
import { reconcileErrorResponse, resolveToday } from '@/lib/finance/reconciliation/request';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = resolveToday(request.nextUrl.searchParams.get('today'));
  try {
    const audit = await loadReconcileAudit(supabase, user.id, today);
    return NextResponse.json({ today, ...audit });
  } catch (err) {
    return reconcileErrorResponse(err);
  }
}
