// app/api/teller/connect/route.ts
// POST: Handle Teller Connect callback — store enrollment, upsert accounts, trigger initial sync.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  encryptToken,
  listAccounts,
  listTransactions,
  mapAccountType,
  mapTellerTransaction,
} from '@/lib/teller';
import { logInfo, logError } from '@/lib/logging';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Teller Connect callback shape varies — extract flexibly:
  //   { accessToken, enrollment: { id, institution: { name } } }  (wrapped)
  //   { accessToken, enrollment_id, institution: { name } }       (flat)
  //   { access_token, enrollment_id, institution: { name } }      (snake_case)
  const accessToken = body.accessToken || body.access_token;
  const enrollmentId = body.enrollment?.id || body.enrollment_id;
  const institution = body.enrollment?.institution || body.institution || {};
  const institutionName = institution.name || institution.institution_name || 'Unknown';
  const institutionId = institution.id || institution.institution_id || null;

  if (!accessToken || !enrollmentId) {
    return NextResponse.json(
      { error: 'Missing Teller Connect data', detail: 'Need accessToken and enrollment_id', receivedKeys: Object.keys(body) },
      { status: 400 },
    );
  }

  const db = getDb();

  // 1. Store enrollment with encrypted access token
  const encrypted = encryptToken(accessToken);

  const { data: enrollmentRow, error: enrollErr } = await db
    .from('teller_enrollments')
    .upsert(
      {
        user_id: user.id,
        enrollment_id: enrollmentId,
        access_token: encrypted,
        institution_name: institutionName,
        institution_id: institutionId,
        status: 'connected',
      },
      { onConflict: 'user_id,enrollment_id' },
    )
    .select()
    .single();

  if (enrollErr) {
    logError({ source: 'api', module: 'finance', message: 'Teller enrollment upsert failed', metadata: { enrollmentId, error: enrollErr.message } });
    return NextResponse.json({ error: enrollErr.message }, { status: 500 });
  }

  logInfo({ source: 'api', module: 'finance', message: 'Teller enrollment created', metadata: { enrollmentId, institution: institutionName } });

  // 2. Fetch accounts from Teller and upsert into financial_accounts
  let tellerAccounts;
  try {
    tellerAccounts = await listAccounts(accessToken);
  } catch (err) {
    logError({ source: 'api', module: 'finance', message: 'Failed to fetch accounts from Teller', metadata: { enrollmentId, error: err instanceof Error ? err.message : 'Unknown' } });
    return NextResponse.json(
      { error: 'Failed to fetch accounts from Teller', enrollment: enrollmentRow },
      { status: 502 },
    );
  }

  const upsertedAccounts = [];
  for (const ta of tellerAccounts) {
    // Check if account already exists by teller_account_id
    const { data: existing } = await db
      .from('financial_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('teller_account_id', ta.id)
      .maybeSingle();

    if (existing) {
      // Update link fields
      const { data } = await db
        .from('financial_accounts')
        .update({
          teller_enrollment_id: enrollmentRow.id,
          institution_name: ta.institution.name,
          last_four: ta.last_four || null,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (data) upsertedAccounts.push(data);
    } else {
      // Create new account
      const { data } = await db
        .from('financial_accounts')
        .insert({
          user_id: user.id,
          name: ta.name,
          account_type: mapAccountType(ta.subtype),
          institution_name: ta.institution.name,
          last_four: ta.last_four || null,
          teller_enrollment_id: enrollmentRow.id,
          teller_account_id: ta.id,
          opening_balance: 0,
        })
        .select()
        .single();
      if (data) upsertedAccounts.push(data);
    }
  }

  // 3. Initial sync — fetch all available transaction history per account
  let totalSynced = 0;
  let oldestDate: string | null = null;

  for (const acct of upsertedAccounts) {
    if (!acct.teller_account_id) continue;
    try {
      const txns = await listTransactions(accessToken, acct.teller_account_id);
      if (!txns.length) continue;

      // Track oldest transaction date
      const dates = txns.map((t) => t.date).sort();
      const acctOldest = dates[0];
      if (!oldestDate || acctOldest < oldestDate) oldestDate = acctOldest;

      // Map and insert (skip duplicates via teller_transaction_id unique index)
      const mapped = txns.map((t) => mapTellerTransaction(t, acct.id, user.id));
      for (const row of mapped) {
        const { error } = await db
          .from('financial_transactions')
          .upsert(row, { onConflict: 'teller_transaction_id', ignoreDuplicates: true });
        if (!error) totalSynced++;
      }

      // Update account with sync timestamp and oldest date
      await db
        .from('financial_accounts')
        .update({
          last_synced_at: new Date().toISOString(),
          oldest_transaction_date: acctOldest,
        })
        .eq('id', acct.id);
    } catch {
      // Non-fatal — account is linked, sync can be retried
    }
  }

  // Update enrollment sync timestamp
  await db
    .from('teller_enrollments')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', enrollmentRow.id);

  logInfo({ source: 'api', module: 'finance', message: 'Teller connect completed', metadata: { enrollmentId, accounts: upsertedAccounts.length, synced: totalSynced } });

  return NextResponse.json({
    enrollment: enrollmentRow,
    accounts: upsertedAccounts,
    synced: totalSynced,
    oldestTransactionDate: oldestDate,
  }, { status: 201 });
}
