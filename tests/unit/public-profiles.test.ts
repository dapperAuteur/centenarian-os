// tests/unit/public-profiles.test.ts
// Keeps lib/profiles/public-profiles.ts in step with migrations 206/207, and makes sure the files
// that read other users' profiles go through the public_profiles view.
// Run: npm run test:unit

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROTECTED_PROFILE_COLUMNS,
  PUBLIC_PROFILE_COLUMNS,
  PUBLIC_PROFILES_VIEW,
} from '../../lib/profiles/public-profiles.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const MIGRATION_206 = read('supabase/migrations/206_profiles_protect_billing_columns.sql');

/** Strip SQL line comments so the header/verification text can't satisfy a match. */
function sqlBody(sql: string): string {
  return sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
}

test('public_profiles view columns match PUBLIC_PROFILE_COLUMNS', () => {
  const body = sqlBody(MIGRATION_206);
  const m = body.match(/CREATE OR REPLACE VIEW public\.public_profiles[\s\S]*?AS\s+SELECT([\s\S]*?)FROM public\.profiles/);
  assert.ok(m, 'view definition not found in 206');
  const cols = m[1]
    .split(',')
    .map((c) => c.trim().replace(/^p\./, ''))
    .filter(Boolean);
  assert.deepEqual(cols, [...PUBLIC_PROFILE_COLUMNS]);
  assert.equal(PUBLIC_PROFILES_VIEW, 'public_profiles');
});

test('trigger protects exactly PROTECTED_PROFILE_COLUMNS', () => {
  const body = sqlBody(MIGRATION_206);
  const m = body.match(/protected_cols constant text\[\] := ARRAY\[([\s\S]*?)\];/);
  assert.ok(m, 'protected_cols array not found in 206');
  const cols = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  assert.deepEqual([...cols].sort(), [...PROTECTED_PROFILE_COLUMNS].sort());
});

test('no protected or billing column is exposed publicly', () => {
  const pub = new Set<string>(PUBLIC_PROFILE_COLUMNS);
  for (const c of PROTECTED_PROFILE_COLUMNS) assert.ok(!pub.has(c), `${c} must not be public`);
  for (const c of ['stripe_customer_id', 'stripe_subscription_id', 'subscription_status', 'shirt_promo_code']) {
    assert.ok(!pub.has(c));
  }
});

test('207 refuses to run without the view and drops the public read policy', () => {
  const body = sqlBody(read('supabase/migrations/207_profiles_private_reads.sql'));
  assert.match(body, /to_regclass\('public\.public_profiles'\) IS NULL/);
  assert.match(body, /DROP POLICY IF EXISTS "Profiles are publicly readable" ON public\.profiles;/);
});

// Files that show OTHER users' names/avatars with the anon key or a user session. After 207 the
// table returns only the caller's own row there, so they must read the view.
const CROSS_USER_READERS = [
  'app/blog/page.tsx',
  'app/blog/authors/page.tsx',
  'app/blog/[username]/page.tsx',
  'app/blog/[username]/[slug]/page.tsx',
  'app/recipes/page.tsx',
  'app/recipes/cooks/page.tsx',
  'app/recipes/cooks/[username]/page.tsx',
  'app/recipes/cooks/[username]/[slug]/page.tsx',
  'components/blog/LikedSavedPosts.tsx',
  'components/recipes/LikedSavedRecipes.tsx',
  'app/api/recipes/route.ts',
];

test('cross-user readers use the public_profiles view on their session client', () => {
  for (const file of CROSS_USER_READERS) {
    const src = read(file);
    assert.match(src, /PUBLIC_PROFILES_VIEW/, `${file} should read from PUBLIC_PROFILES_VIEW`);
    // Any remaining direct table read must be on the service-role client (named `db`). `\s*`
    // spans newlines, so multi-line chains (`await supabase\n  .from('profiles')`) are caught.
    const direct = [...src.matchAll(/(\w+)\s*\.from\(\s*['"]profiles['"]\s*\)/g)].map((x) => x[1]);
    for (const v of direct) assert.equal(v, 'db', `${file}: ${v}.from('profiles') should use the view`);
  }
});
