// app/api/finance/accounts/[id]/route.ts
// PATCH: update account fields, including csv_import_mapping (the statement-import
//        settings saved for the account: { mapping, sign, dateOrder, includePending?, preset? } or null)
// DELETE: deactivate (soft) or hard-delete if no transactions

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  ImportError,
  MIGRATION_REQUIRED_MESSAGE,
  isMissingSchemaError,
} from '@/lib/finance/csv-import/errors';
import { sanitizeSavedMapping } from '@/lib/finance/csv-import/service';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: acct } = await db
    .from('financial_accounts')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (!acct || acct.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const allowed = [
    'name', 'account_type', 'institution_name', 'last_four',
    'interest_rate', 'credit_limit', 'opening_balance',
    'monthly_fee', 'due_date', 'statement_date', 'is_active', 'notes',
    // Institution policy fields
    'dispute_window_days', 'default_return_days',
    'promo_apr', 'promo_apr_expires', 'promo_description',
    'bt_apr', 'bt_fee_percent', 'bt_expires', 'bt_description',
    'rewards_type', 'rewards_rate', 'annual_fee',
    // Statement-import settings remembered for this account (migration 203)
    'csv_import_mapping',
  ];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  // { mapping, sign, dateOrder, includePending?, preset? } or null to forget it.
  // Checked here so a malformed value can't be stored and break the next import.
  if ('csv_import_mapping' in updates) {
    try {
      updates.csv_import_mapping = sanitizeSavedMapping(updates.csv_import_mapping);
    } catch (err) {
      const message = err instanceof ImportError ? err.message : 'csv_import_mapping is not valid.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const { data, error } = await db
    .from('financial_accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // The column arrives with migration 203: say so instead of a raw schema error.
    if (isMissingSchemaError(error)) {
      return NextResponse.json(
        { error: MIGRATION_REQUIRED_MESSAGE, code: 'migration_required' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: acct } = await db
    .from('financial_accounts')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (!acct || acct.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check if any transactions reference this account
  const { count } = await db
    .from('financial_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', id);

  if ((count ?? 0) > 0) {
    // Soft-delete: deactivate so transactions remain intact
    const { error } = await db
      .from('financial_accounts')
      .update({ is_active: false })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deactivated: true });
  }

  const { error } = await db.from('financial_accounts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
