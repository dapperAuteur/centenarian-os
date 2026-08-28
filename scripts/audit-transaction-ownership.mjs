#!/usr/bin/env node
// scripts/audit-transaction-ownership.mjs
// Answers one question for the CentOS/Work.WitUS database split: in financial_transactions, is
// `job_id IS NOT NULL` a reliable business/personal discriminator? That decides whether the
// finance half of the split is a script or a manual pass (plans/55-stage2-db-split.md §3).
//
// It joins transactions to auth.users so every row carries an EMAIL. That matters because both
// apps seed this table (centenarian-os/lib/demo/seed.ts and
// contractor-os/lib/demo/seed-lister.ts:180) and a query without emails cannot tell a fixture
// from a real entry.
//
// Read-only. Never writes.
//
// Usage:
//   node --env-file=.env.local scripts/audit-transaction-ownership.mjs
//   node --env-file=.env.local scripts/audit-transaction-ownership.mjs --email=you@example.com
//   node --env-file=.env.local scripts/audit-transaction-ownership.mjs --list=60
//   node --env-file=.env.local scripts/audit-transaction-ownership.mjs --csv > audit.csv
//   node --env-file=.env.local scripts/audit-transaction-ownership.mjs --email=you@x.com --accounts
//   node --env-file=.env.local scripts/audit-transaction-ownership.mjs --email=you@x.com --no-account

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars. Run with: node --env-file=.env.local scripts/audit-transaction-ownership.mjs');
  process.exit(1);
}

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const ONLY_EMAIL = arg('email');
const LIST_N = Number.parseInt(arg('list') ?? '40', 10);
const CSV = process.argv.includes('--csv');
const ACCOUNTS = process.argv.includes('--accounts');
const NO_ACCOUNT = process.argv.includes('--no-account');
// Comma-separated account NAMES classified as business. Validates the split rule before any
// migration acts on it: how many rows move, and — more importantly — which rows the rule misses.
const BUSINESS = (arg('business') ?? '').split(',').map((x) => x.trim()).filter(Boolean);

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- 1. user_id -> email. auth.users is not exposed through PostgREST, so use the admin API. ---
const emailById = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) {
    console.error(`Could not list users: ${error.message}`);
    process.exit(1);
  }
  for (const u of data.users) emailById.set(u.id, u.email ?? '(no email)');
  if (data.users.length < 1000) break;
}

// --- 2. All transactions, paged. Service role bypasses RLS, so this sees every user. ---
const rows = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from('financial_transactions')
    .select('id, user_id, transaction_date, type, amount, vendor, description, source, job_id, category_id, brand_id, account_id, created_at')
    .order('created_at', { ascending: false })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error(`Could not read financial_transactions: ${error.message}`);
    process.exit(1);
  }
  rows.push(...(data ?? []));
  if (!data || data.length < PAGE) break;
}

const withEmail = rows.map((r) => ({ ...r, email: emailById.get(r.user_id) ?? '(unknown user)' }));
const scoped = ONLY_EMAIL ? withEmail.filter((r) => r.email === ONLY_EMAIL) : withEmail;

if (CSV) {
  const cols = ['email', 'transaction_date', 'type', 'amount', 'vendor', 'description', 'source', 'has_job_id', 'category_id', 'brand_id'];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  console.log(cols.join(','));
  for (const r of scoped) {
    console.log(cols.map((c) => esc(c === 'has_job_id' ? r.job_id != null : r[c])).join(','));
  }
  process.exit(0);
}

// --- 3. Per-user summary. This is the number that actually matters. ---
console.log(`\n${rows.length} transactions across ${new Set(rows.map((r) => r.user_id)).size} user(s).\n`);
console.log('PER USER');
console.log('-'.repeat(78));
console.log('email'.padEnd(38) + 'with job_id'.padStart(12) + 'no job_id'.padStart(12) + 'total'.padStart(10));
console.log('-'.repeat(78));

const byEmail = new Map();
for (const r of scoped) {
  const e = byEmail.get(r.email) ?? { withJob: 0, noJob: 0 };
  if (r.job_id != null) e.withJob++;
  else e.noJob++;
  byEmail.set(r.email, e);
}
for (const [email, c] of [...byEmail.entries()].sort((a, b) => (b[1].withJob + b[1].noJob) - (a[1].withJob + a[1].noJob))) {
  console.log(
    email.slice(0, 37).padEnd(38) +
    String(c.withJob).padStart(12) +
    String(c.noJob).padStart(12) +
    String(c.withJob + c.noJob).padStart(10),
  );
}

const totalWithJob = scoped.filter((r) => r.job_id != null).length;
console.log('-'.repeat(78));
if (totalWithJob === 0) {
  console.log('\n>> NO transaction anywhere has a job_id.');
  console.log('   The discriminator is dead on arrival: it cannot separate anything.');
  console.log('   Test category_id / brand_id instead (see the business scan below).');
}

// --- 4. Business scan. The rows that decide the answer are business-looking rows WITHOUT a
//        job_id: if any exist, `job_id IS NOT NULL` cannot be trusted to move the right rows. ---
// NOTE: /union/ was removed. It matched "Everwise Credit Union" on every ATM row, which is
// personal banking, and inflated the first run's count. Union LOCALS are matched specifically.
const BUSINESS_HINTS = [
  /\bcrew\b/i, /\bdues\b/i, /\bIBEW\b/i, /\bIATSE\b/i, /\blocal \d+\b/i,
  /\binvoice\b/i, /\bclient\b/i, /\bconsult/i, /\bcontract/i,
  /\bB&H\b/i, /\bcamera\b/i, /\baudio\b/i, /\bgear\b/i, /\bequipment\b/i, /\bcable/i,
  /\bper ?diem\b/i, /\bstadium\b/i, /\bvenue\b/i, /\bjob\b/i, /\bgig\b/i,
  /\boffice supplies\b/i, /\bsubscription\b/i, /\bworkspace\b/i,
];
// Personal banking mechanics are never business signal, however they are worded.
const NOT_BUSINESS = [/\bATM\b/i, /credit union/i, /\bdeposit at\b/i, /\bwithdrawal\b/i, /\btransfer to\b/i];
const looksBusiness = (r) => {
  const hay = `${r.vendor ?? ''} ${r.description ?? ''}`;
  if (NOT_BUSINESS.some((re) => re.test(hay))) return false;
  return BUSINESS_HINTS.some((re) => re.test(hay));
};

const suspects = scoped.filter((r) => r.job_id == null && looksBusiness(r));
console.log(`\nBUSINESS-LOOKING ROWS WITH NO job_id: ${suspects.length}`);
console.log('These are what break the discriminator. Each one would be left behind in CentOS');
console.log('by a `job_id IS NOT NULL` migration, even though it belongs to the business.');
console.log('-'.repeat(110));
for (const r of suspects.slice(0, LIST_N)) {
  console.log(
    `${r.transaction_date}  ${String(r.amount).padStart(9)}  ` +
    `${(r.vendor ?? '').slice(0, 24).padEnd(25)} ${(r.description ?? '').slice(0, 40).padEnd(41)} ${r.email.slice(0, 22)}`,
  );
}
if (suspects.length > LIST_N) console.log(`...and ${suspects.length - LIST_N} more (use --list=N)`);

// --- 5. Do category_id / brand_id do a better job? ---
const withCat = suspects.filter((r) => r.category_id != null).length;
const withBrand = suspects.filter((r) => r.brand_id != null).length;
console.log('\nWOULD ANOTHER COLUMN WORK BETTER?');
console.log(`  of those ${suspects.length} business-looking rows: ${withCat} have a category_id, ${withBrand} have a brand_id`);

// --- 5b. Which column actually PARTITIONS this ledger? job_id is measured above; if it is
//         unused, the split still needs a rule, and these are the candidates. Coverage is what
//         matters: a discriminator that leaves half the rows unclassified is not a discriminator. ---
const scopeLabel = ONLY_EMAIL ?? 'all users';
console.log(`\nCANDIDATE DISCRIMINATORS (${scopeLabel}, ${scoped.length} rows)`);
console.log('-'.repeat(78));
console.log('column'.padEnd(16) + 'rows set'.padStart(11) + 'rows null'.padStart(11) + 'coverage'.padStart(11) + '  distinct values');
console.log('-'.repeat(78));
for (const col of ['job_id', 'brand_id', 'category_id', 'account_id']) {
  const set = scoped.filter((r) => r[col] != null);
  const distinct = new Set(set.map((r) => r[col])).size;
  const pct = scoped.length ? ((set.length / scoped.length) * 100).toFixed(1) : '0.0';
  console.log(
    col.padEnd(16) +
    String(set.length).padStart(11) +
    String(scoped.length - set.length).padStart(11) +
    `${pct}%`.padStart(11) +
    `  ${distinct}`,
  );
}
console.log('-'.repeat(78));
console.log('Read this as: a column with high coverage AND few distinct values is a usable');
console.log('business/personal flag. High coverage with hundreds of distinct values (account_id,');
console.log('category_id) only helps if you can say which of those values are the business ones.');

// --- 5c. Account breakdown. When account_id is the winning discriminator, the whole split
//         reduces to classifying a short list of accounts once, by hand. Print that list with
//         enough context to decide each one, plus the rows that have no account at all. ---
if (ACCOUNTS) {
  const ids = [...new Set(scoped.map((r) => r.account_id).filter(Boolean))];
  const { data: accts, error: acctErr } = await db
    .from('financial_accounts')
    .select('id, name, account_type, institution_name, last_four, is_active, teller_account_id')
    .in('id', ids);
  if (acctErr) {
    console.error(`Could not read financial_accounts: ${acctErr.message}`);
  } else {
    const byId = new Map((accts ?? []).map((a) => [a.id, a]));
    const stats = new Map();
    for (const r of scoped) {
      const k = r.account_id ?? '(none)';
      const e = stats.get(k) ?? { n: 0, income: 0, expense: 0, first: r.transaction_date, last: r.transaction_date };
      e.n++;
      if (r.type === 'income') e.income += Number(r.amount ?? 0);
      else e.expense += Number(r.amount ?? 0);
      if (r.transaction_date < e.first) e.first = r.transaction_date;
      if (r.transaction_date > e.last) e.last = r.transaction_date;
      stats.set(k, e);
    }

    console.log(`\nACCOUNTS (${stats.size}) — classify each B(usiness) or P(ersonal) once, and the split is decided`);
    console.log('-'.repeat(118));
    // Same name + same institution across two ids almost always means one manual account and one
    // Teller-linked copy of the same real account. They MUST be classified identically or the
    // split will send half of one account's history to the wrong database.
    const nameKey = (a) => `${(a?.name ?? '').toLowerCase()}|${(a?.institution_name ?? '').toLowerCase()}`;
    const nameCounts = new Map();
    for (const id of stats.keys()) {
      if (id === '(none)') continue;
      const k = nameKey(byId.get(id));
      nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1);
    }

    console.log(
      'B/P'.padEnd(5) + 'account'.padEnd(30) + 'type'.padEnd(13) + 'institution'.padEnd(20) +
      'txns'.padStart(6) + 'income'.padStart(13) + 'expense'.padStart(13) + '  src   active window',
    );
    console.log('-'.repeat(118));
    const money = (n) => (n ? n.toFixed(2) : '-');
    for (const [id, e] of [...stats.entries()].sort((a, b) => b[1].n - a[1].n)) {
      const a = byId.get(id);
      const name = id === '(none)' ? '(no account set)' : (a?.name ?? '(deleted account)');
      const dup = id !== '(none)' && (nameCounts.get(nameKey(a)) ?? 0) > 1 ? ' *DUP' : '';
      console.log(
        '[ ] '.padEnd(5) +
        name.slice(0, 29).padEnd(30) +
        (a?.account_type ?? '-').padEnd(13) +
        (a?.institution_name ?? '-').slice(0, 19).padEnd(20) +
        String(e.n).padStart(6) +
        money(e.income).padStart(13) +
        money(e.expense).padStart(13) +
        `  ${(a?.teller_account_id ? 'teller' : 'manual').padEnd(6)}${e.first} to ${e.last}${dup}`,
      );
    }
    console.log('-'.repeat(118));
    const dups = [...nameCounts.values()].filter((n) => n > 1).length;
    if (dups > 0) {
      console.log(`\n${dups} account name(s) appear more than once (*DUP above), usually one manual`);
      console.log('row and one Teller-linked row for the SAME real account. Classify every copy the');
      console.log('same way, or half that account\'s history lands in the wrong database.');
    }
    const none = stats.get('(none)');
    if (none) {
      console.log(`\n${none.n} row(s) have NO account_id. Those are the manual remainder — list them with:`);
      console.log('  ... --no-account');
    }
  }
}

if (NO_ACCOUNT) {
  const orphans = scoped.filter((r) => r.account_id == null);
  console.log(`\nROWS WITH NO account_id (${orphans.length}) — the manual remainder`);
  console.log('-'.repeat(110));
  for (const r of orphans.slice(0, LIST_N)) {
    console.log(
      `${r.transaction_date}  ${String(r.amount).padStart(10)}  ${r.type.padEnd(8)}` +
      `${(r.vendor ?? '').slice(0, 26).padEnd(27)} ${(r.description ?? '').slice(0, 44)}`,
    );
  }
  if (orphans.length > LIST_N) console.log(`...and ${orphans.length - LIST_N} more (use --list=N)`);
}

// --- 5d. Validate a proposed business/personal rule. A rule is only as good as what it MISSES:
//         a business row left behind in CentOS is silent data in the wrong database. ---
if (BUSINESS.length > 0) {
  const ids = [...new Set(scoped.map((r) => r.account_id).filter(Boolean))];
  const { data: accts, error: acctErr } = await db
    .from('financial_accounts')
    .select('id, name')
    .in('id', ids);
  if (acctErr) {
    console.error(`Could not read financial_accounts: ${acctErr.message}`);
  } else {
    const norm = (x) => (x ?? '').trim().toLowerCase();
    const wanted = new Set(BUSINESS.map(norm));
    const bizIds = new Set((accts ?? []).filter((a) => wanted.has(norm(a.name))).map((a) => a.id));
    const matchedNames = new Set((accts ?? []).filter((a) => bizIds.has(a.id)).map((a) => a.name));

    // A name in --business that matched nothing is a typo, and a typo silently shrinks the
    // business set. Say so loudly rather than reporting a confident wrong number.
    const unmatched = BUSINESS.filter((b) => ![...matchedNames].some((m) => norm(m) === norm(b)));
    console.log(`\nRULE CHECK — account_id IN (${bizIds.size} account(s) matched)`);
    console.log('-'.repeat(78));
    for (const n of matchedNames) console.log(`  business: ${n}`);
    if (unmatched.length) {
      console.log(`\n  !! ${unmatched.length} name(s) in --business matched NO account:`);
      for (const u of unmatched) console.log(`     "${u}"`);
      console.log('     Fix these before trusting the numbers below.');
    }

    const moves = scoped.filter((r) => r.account_id && bizIds.has(r.account_id));
    const stays = scoped.filter((r) => !(r.account_id && bizIds.has(r.account_id)));
    console.log('-'.repeat(78));
    console.log(`  moves to Work.WitUS: ${moves.length}`);
    console.log(`  stays in CentOS    : ${stays.length}  (incl. ${stays.filter((r) => !r.account_id).length} with no account)`);

    // The two error classes, named for what they cost.
    const missed = stays.filter(looksBusiness);
    const swept = moves.filter((r) => !looksBusiness(r));
    console.log(`\n  MISSES — business-looking rows the rule LEAVES in CentOS: ${missed.length}`);
    for (const r of missed.slice(0, LIST_N)) {
      const acct = (accts ?? []).find((a) => a.id === r.account_id);
      console.log(
        `    ${r.transaction_date}  ${String(r.amount).padStart(9)}  ` +
        `${(r.vendor ?? '').slice(0, 26).padEnd(27)} ${(acct?.name ?? '(no account)').slice(0, 30)}`,
      );
    }
    if (missed.length > LIST_N) console.log(`    ...and ${missed.length - LIST_N} more`);
    console.log(`\n  (${swept.length} rows on business accounts do not look business by keyword — expected, keywords are weak)`);
  }
}

console.log('\nVERDICT');
if (suspects.length === 0 && totalWithJob > 0) {
  console.log('  job_id looks RELIABLE. No business-looking row is missing one.');
  console.log('  -> The finance split can be a script.');
} else {
  console.log(`  job_id is NOT reliable: ${suspects.length} business-looking rows have no job_id.`);
  console.log('  -> The finance split needs a manual pass or a better rule.');
  console.log('     Check the category_id/brand_id counts above before designing one.');
}
console.log('\nNote: rows seeded by the demo fixtures are included. Compare emails above against your');
console.log('demo account (DEMO_VISITOR_USER_EMAIL, default demo@centenarianos.com), and re-run with');
console.log('--email=<your real address> to scope the verdict to your own ledger.\n');
