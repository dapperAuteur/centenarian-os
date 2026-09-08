#!/usr/bin/env node
// scripts/phase3-export.mjs
// Export every row that moves to Work.WitUS's database, as JSON, one file per table.
//
// Read-only against Supabase. Writes to ./phase3-export/ (gitignored — it contains real data).
//
// TWO ROW SETS, and the difference matters:
//   MOVES   contractor-owned tables — every row.
//   COPIES  CentOS-owned tables the moving set has foreign keys into — every row, EXCEPT
//           financial_transactions, whose rows are selected by the finance rule (161 by business
//           account + 13 by explicit exception). Copying all 878 would hand Work.WitUS the
//           personal ledger.
//
// Usage: node --env-file=.env.local scripts/phase3-export.mjs

import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const OUT = 'phase3-export';

const MOVES = [
  'contractor_jobs', 'contractor_job_assignments', 'contractor_events', 'contractor_rate_cards',
  'job_time_entries', 'job_notes', 'job_documents', 'job_replacement_requests',
  'invoices', 'invoice_items', 'invoice_templates', 'invoice_template_items',
  'paychecks', 'paycheck_invoices', 'paycheck_taxes', 'paycheck_deposits',
  'union_memberships', 'union_dues_payments', 'union_documents', 'union_document_chunks',
  'union_rag_submissions',
  'contact_phones', 'contact_emails', 'contact_tags', 'contact_job_roles', 'contact_shares',
  'contact_addresses', 'contact_locations',
];
const COPIES_FULL = ['profiles', 'user_brands', 'financial_accounts', 'budget_categories', 'user_contacts'];

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

mkdirSync(OUT, { recursive: true });

async function dumpAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').range(from, from + 999);
    if (error) return { error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { rows };
}

let total = 0;
const manifest = {};

for (const t of [...MOVES, ...COPIES_FULL]) {
  const r = await dumpAll(t);
  if (r.error) { console.log(`  ${t.padEnd(30)} ERROR ${r.error.slice(0, 40)}`); continue; }
  writeFileSync(`${OUT}/${t}.json`, JSON.stringify(r.rows, null, 0));
  manifest[t] = r.rows.length;
  total += r.rows.length;
  console.log(`  ${t.padEnd(30)} ${String(r.rows.length).padStart(6)}`);
}

// financial_transactions: rule-selected only. Two queries unioned by id so a row matching both
// the account rule and the exception list is not written twice.
const picked = new Map();
for (const [col, vals] of [['account_id', BUSINESS_ACCOUNTS], ['id', EXCEPTIONS]]) {
  const { data, error } = await db.from('financial_transactions').select('*').in(col, vals);
  if (error) { console.log(`  financial_transactions ERROR ${error.message}`); break; }
  for (const row of data ?? []) picked.set(row.id, row);
}
const ft = [...picked.values()];
writeFileSync(`${OUT}/financial_transactions.json`, JSON.stringify(ft, null, 0));
manifest.financial_transactions = ft.length;
total += ft.length;
console.log(`  ${'financial_transactions'.padEnd(30)} ${String(ft.length).padStart(6)}  (rule-selected, not all)`);

writeFileSync(`${OUT}/_manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n${Object.keys(manifest).length} tables, ${total} rows -> ${OUT}/`);
console.log('Manifest written. phase3-load.mjs verifies against it after loading.\n');
