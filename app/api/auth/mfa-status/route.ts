// app/api/auth/mfa-status/route.ts
// Returns whether MFA is required for the current user (has health or financial data).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ mfaRequired: false });
  }

  // Check for financial transactions
  const { count: txCount } = await supabase
    .from('financial_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .limit(1);

  if (txCount && txCount > 0) {
    return NextResponse.json({ mfaRequired: true });
  }

  // Check for health metrics
  const { count: healthCount } = await supabase
    .from('user_health_metrics')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .limit(1);

  if (healthCount && healthCount > 0) {
    return NextResponse.json({ mfaRequired: true });
  }

  return NextResponse.json({ mfaRequired: false });
}
