// app/api/finance/reminders/route.ts
// GET: returns upcoming/overdue invoice reminders + credit card/loan due date reminders

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
  const today = new Date().toISOString().split('T')[0];
  const dayOfMonth = new Date().getDate();
  const soonThreshold = dayOfMonth + 7;

  // Unpaid invoices with due dates
  const { data: invoices } = await db
    .from('invoices')
    .select('id, direction, status, contact_name, total, amount_paid, due_date, invoice_number')
    .eq('user_id', user.id)
    .not('status', 'in', '("paid","cancelled")')
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true });

  const invoiceReminders = (invoices ?? []).map((inv) => {
    const balanceDue = Number(inv.total) - Number(inv.amount_paid);
    const isOverdue = inv.due_date < today && inv.status !== 'paid';
    const isDueSoon = !isOverdue && inv.due_date <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    return {
      type: 'invoice' as const,
      id: inv.id,
      direction: inv.direction,
      contact_name: inv.contact_name,
      invoice_number: inv.invoice_number,
      total: Number(inv.total),
      balance_due: balanceDue,
      due_date: inv.due_date,
      urgency: isOverdue ? 'overdue' : isDueSoon ? 'due_soon' : 'upcoming',
    };
  });

  // Credit card / loan accounts with due dates
  const { data: accounts } = await db
    .from('financial_accounts')
    .select('id, name, account_type, due_date, monthly_fee')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('account_type', ['credit_card', 'loan'])
    .not('due_date', 'is', null);

  const accountReminders = (accounts ?? []).map((acct) => {
    const dueDay = Number(acct.due_date);
    const isDueNow = dayOfMonth >= dueDay && dayOfMonth <= dueDay + 2;
    const isDueSoon = !isDueNow && dueDay <= soonThreshold;
    return {
      type: 'account' as const,
      id: acct.id,
      name: acct.name,
      account_type: acct.account_type,
      due_day: dueDay,
      monthly_fee: acct.monthly_fee ? Number(acct.monthly_fee) : null,
      urgency: isDueNow ? 'due_now' : isDueSoon ? 'due_soon' : 'upcoming',
    };
  });

  return NextResponse.json({
    invoices: invoiceReminders,
    accounts: accountReminders,
    overdue_count: invoiceReminders.filter((r) => r.urgency === 'overdue').length,
    due_soon_count: invoiceReminders.filter((r) => r.urgency === 'due_soon').length
      + accountReminders.filter((r) => r.urgency === 'due_soon' || r.urgency === 'due_now').length,
  });
}
