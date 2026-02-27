// app/api/finance/recurring/generate/route.ts
// POST: auto-generate due recurring transactions (max 12 catch-up months)

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: recurrings } = await db
    .from('recurring_payments')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (!recurrings || recurrings.length === 0) {
    return NextResponse.json({ generated: 0 });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const toInsert: Record<string, unknown>[] = [];
  const updates: { id: string; last_generated: string }[] = [];

  for (const rp of recurrings) {
    const dayOfMonth = Number(rp.day_of_month);

    // Determine the starting month to generate from
    let startDate: Date;
    if (rp.last_generated) {
      // Start from the month after last_generated
      const lg = new Date(rp.last_generated);
      startDate = new Date(lg.getFullYear(), lg.getMonth() + 1, dayOfMonth);
    } else {
      // First generation — start from the creation month
      const created = new Date(rp.created_at);
      startDate = new Date(created.getFullYear(), created.getMonth(), dayOfMonth);
      // If the creation day is after the day_of_month, start next month
      if (created.getDate() > dayOfMonth) {
        startDate.setMonth(startDate.getMonth() + 1);
      }
    }

    let generated = 0;
    let lastGenDate: string | null = null;
    const MAX_CATCHUP = 12;

    while (startDate <= today && generated < MAX_CATCHUP) {
      const txDate = startDate.toISOString().split('T')[0];
      toInsert.push({
        user_id: user.id,
        amount: Number(rp.amount),
        type: rp.type,
        description: rp.description,
        transaction_date: txDate,
        account_id: rp.account_id,
        category_id: rp.category_id,
        source: 'recurring',
      });
      lastGenDate = txDate;
      generated++;
      startDate.setMonth(startDate.getMonth() + 1);
    }

    if (lastGenDate) {
      updates.push({ id: rp.id, last_generated: lastGenDate });
    }
  }

  let totalGenerated = 0;

  if (toInsert.length > 0) {
    const { data, error } = await db
      .from('financial_transactions')
      .insert(toInsert)
      .select('id');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    totalGenerated = data?.length ?? 0;
  }

  // Update last_generated for each recurring payment
  for (const u of updates) {
    await db
      .from('recurring_payments')
      .update({ last_generated: u.last_generated })
      .eq('id', u.id);
  }

  return NextResponse.json({ generated: totalGenerated });
}
