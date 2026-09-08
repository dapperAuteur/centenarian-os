#!/usr/bin/env node
// scripts/phase3-inventory.mjs
// Stage 2, Phase 3: what actually moves to Work.WitUS's database, measured rather than assumed.
//
// Reads the SHARED database and reports row counts for every table in the move set, plus the
// finance rule's split. Read-only. Run it before and after the migration; the numbers either
// match or the migration is incomplete.
//
// Usage: node --env-file=.env.local scripts/phase3-inventory.mjs

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

// Contractor-owned. Derived from contractor-os migrations, then verified against the live DB below.
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

// Shared: copied, not moved. Both apps keep a row set after the split (Route B for profiles).
const COPIES = ['profiles', 'user_contacts', 'equipment'];

// Stays in CentOS except for the rows the finance rule selects.
const SPLIT = ['financial_transactions'];

const BUSINESS_ACCOUNTS = [
  '25513a53-a71e-423c-8208-c7680ac077fb', // AZFCU BUSINESS CHECKING PLUS
  '02def6b3-c526-48e9-a951-c71c2bf78228', // AZFCU BUSINESS VISA CREDIT CARD
];
// Business rows on personal/no account. See plans/ecosystem/phase3-finance-rule.md.
const EXCEPTIONS = [
  'de0286dc-507b-4ed9-81e0-e87f8bca0072', '818daafe-4d8a-45f1-801e-e79b40f842e2',
  'd6074eb7-2e61-49ff-ba11-8a1b74ccacc2', '59806874-d48a-47da-896e-b51221f51ac6',
  '962d890e-b78c-4072-a31b-3112bb23110c', 'a5bfc6b1-f6cd-481a-8bc3-1d540969cbcc',
  'bd3543a6-7cfb-48fb-b8dc-e3881d973aa8', 'f28e9b8a-44a6-4720-92ad-941cc3479a1b',
  '740d0079-b929-40ec-9ad3-28e79573a8f3', '77821647-c909-4fce-8e16-114e5104f7f2',
  'a9c4c508-49e9-46b2-a125-cc0851b8e67b', '7b1ed353-6bc6-4032-ab0e-cf05fab4566a',
  '984e8dee-7e87-4244-8f48-c2b4bfc8179d',
];

const count = async (t) => {
  const { count: c, error } = await db.from(t).select('id', { count: 'exact', head: true });
  return error ? { err: error.message } : { n: c ?? 0 };
};

const section = async (title, tables) => {
  console.log(`\n${title}`);
  console.log('-'.repeat(64));
  let total = 0, missing = 0;
  for (const t of tables) {
    const r = await count(t);
    if (r.err) {
      // A table in the list that does not exist is a list error worth seeing, not a crash.
      console.log(`  ${t.padEnd(30)} —  ${r.err.slice(0, 28)}`);
      missing++;
    } else {
      console.log(`  ${t.padEnd(30)} ${String(r.n).padStart(7)}`);
      total += r.n;
    }
  }
  console.log('-'.repeat(64));
  console.log(`  ${String(tables.length - missing).padStart(2)} tables, ${total} rows${missing ? `  (${missing} not found)` : ''}`);
  return total;
};

console.log('PHASE 3 MOVE INVENTORY — shared Supabase, all users');
await section('MOVES to Work.WitUS (contractor-owned)', MOVES);
await section('COPIES (both apps keep a set; profiles is Route B)', COPIES);

console.log('\nSPLIT BY RULE');
console.log('-'.repeat(64));
for (const t of SPLIT) {
  const all = await count(t);
  const { count: byAcct } = await db.from(t).select('id', { count: 'exact', head: true }).in('account_id', BUSINESS_ACCOUNTS);
  const { count: byExc } = await db.from(t).select('id', { count: 'exact', head: true }).in('id', EXCEPTIONS);
  // An exception row already on a business account would be double-counted; check the overlap.
  const { count: both } = await db.from(t).select('id', { count: 'exact', head: true })
    .in('account_id', BUSINESS_ACCOUNTS).in('id', EXCEPTIONS);
  const moves = (byAcct ?? 0) + (byExc ?? 0) - (both ?? 0);
  console.log(`  ${t}`);
  console.log(`    total                 ${String(all.n ?? 0).padStart(7)}`);
  console.log(`    by business account   ${String(byAcct ?? 0).padStart(7)}`);
  console.log(`    by exception id       ${String(byExc ?? 0).padStart(7)}${both ? `  (${both} already counted above)` : ''}`);
  console.log(`    MOVES                 ${String(moves).padStart(7)}`);
  console.log(`    stays in CentOS       ${String((all.n ?? 0) - moves).padStart(7)}`);
}
console.log('-'.repeat(64));
console.log('\nRun again after the migration. The MOVES numbers must match on the Neon side.\n');
