// app/api/contractor/union/dues-summary/route.ts
// GET: overview of upcoming dues, total paid YTD, status per union

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;

  // Get all memberships
  const { data: memberships } = await db
    .from('union_memberships')
    .select('*')
    .eq('user_id', user.id);

  // Get YTD payments
  const { data: payments } = await db
    .from('union_dues_payments')
    .select('amount, membership_id')
    .eq('user_id', user.id)
    .gte('payment_date', yearStart);

  const totalPaidYtd = (payments ?? []).reduce((sum, p) => sum + (p.amount || 0), 0);

  // Categorize memberships by urgency
  const today = now.toISOString().split('T')[0];
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const upcoming: typeof memberships = [];
  const overdue: typeof memberships = [];
  const current: typeof memberships = [];

  for (const m of memberships ?? []) {
    if (!m.next_dues_date) {
      current.push(m);
      continue;
    }
    if (m.next_dues_date < today) {
      overdue.push(m);
    } else if (m.next_dues_date <= thirtyDaysOut) {
      upcoming.push(m);
    } else {
      current.push(m);
    }
  }

  return NextResponse.json({
    total_memberships: (memberships ?? []).length,
    total_paid_ytd: totalPaidYtd,
    overdue: overdue ?? [],
    upcoming: upcoming ?? [],
    current: current ?? [],
  });
}
