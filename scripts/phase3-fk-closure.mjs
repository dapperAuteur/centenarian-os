#!/usr/bin/env node
// scripts/phase3-fk-closure.mjs
// Three moving tables hold a foreign key into financial_transactions, whose ROWS are split by the
// finance rule rather than moved wholesale:
//
//   invoices.transaction_id · paycheck_deposits.transaction_id · union_dues_payments.transaction_id
//
// A referenced transaction that the rule leaves in CentOS becomes a dangling FK on Neon. That is
// the one failure in this migration that does not announce itself: the constraint can be satisfied
// by whichever rows happened to move.
//
// This measures the gap. Read-only.
//
// Usage: node --env-file=.env.local scripts/phase3-fk-closure.mjs

import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const BUSINESS_ACCOUNTS = [
  '25513a53-a71e-423c-8208-c7680ac077fb', '02def6b3-c526-48e9-a951-c71c2bf78228',
];
const EXCEPTIONS = [
  'de0286dc-507b-4ed9-81e0-e87f8bca0072', '818daafe-4d8a-45f1-801e-e79b40f842e2',
  'd6074eb7-2e61-49ff-ba11-8a1b74ccacc2', '59806874-d48a-47da-896e-b51221f51ac6',
  '962d890e-b78c-4072-a31b-3112bb23110c', 'a5bfc6b1-f6cd-481a-8bc3-1d540969cbcc',
  'bd3543a6-7cfb-48fb-b8dc-e3881d973aa8', 'f28e9b8a-44a6-4720-92ad-941cc3479a1b',
  '740d0079-b929-40ec-9ad3-28e79573a8f3', '77821647-c909-4fce-8e16-114e5104f7f2',
  'a9c4c508-49e9-46b2-a125-cc0851b8e67b', '7b1ed353-6bc6-4032-ab0e-cf05fab4566a',
  '984e8dee-7e87-4244-8f48-c2b4bfc8179d',
];

// The rule's row set.
const moving = new Set();
for (const [col, vals] of [['account_id', BUSINESS_ACCOUNTS], ['id', EXCEPTIONS]]) {
  const { data } = await db.from('financial_transactions').select('id').in(col, vals);
  for (const r of data ?? []) moving.add(r.id);
}
console.log(`\nfinance rule selects ${moving.size} transactions to move\n`);

const REFS = [
  ['invoices', 'transaction_id'],
  ['paycheck_deposits', 'transaction_id'],
  ['union_dues_payments', 'transaction_id'],
];

let dangling = 0;
for (const [table, col] of REFS) {
  const { data, error } = await db.from(table).select(`id, ${col}`).not(col, 'is', null);
  if (error) { console.log(`  ${table.padEnd(22)} ${error.message}`); continue; }
  const refs = (data ?? []).map((r) => r[col]);
  const missing = refs.filter((t) => !moving.has(t));
  dangling += missing.length;
  console.log(`  ${table.padEnd(22)} ${String(refs.length).padStart(4)} reference(s), ${String(missing.length).padStart(4)} point at a transaction the rule LEAVES BEHIND`);
  for (const m of missing.slice(0, 5)) {
    const { data: tx } = await db.from('financial_transactions')
      .select('transaction_date, type, amount, vendor, description').eq('id', m).maybeSingle();
    if (tx) console.log(`      ${tx.transaction_date}  ${String(tx.amount).padStart(9)}  ${tx.type.padEnd(7)} ${(tx.vendor ?? '').slice(0,22)}`);
  }
  if (missing.length > 5) console.log(`      ...and ${missing.length - 5} more`);
}

console.log('');
if (dangling === 0) {
  console.log('CLOSED. Every referenced transaction is already in the move set.');
  console.log('The foreign keys can be created on Neon as-is.');
} else {
  console.log(`NOT CLOSED. ${dangling} reference(s) would dangle.`);
  console.log('Options, in order of preference:');
  console.log('  1. Widen the move set to include them (FK closure) — keeps the constraint honest.');
  console.log('  2. Null the column on the moved rows — loses the link, keeps referential integrity.');
  console.log('  3. Drop the FK and keep a soft reference — do this only if 1 and 2 are both wrong.');
}
console.log('');
