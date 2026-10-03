#!/usr/bin/env node
// scripts/teller-revoke-all.mjs
// One-off: revoke every Teller bank enrollment at Teller, then wipe the stored
// access tokens. Run it ONCE, before the Teller env vars are deleted. Teller
// bank linking has been removed from the app; this script is what ends the
// vendor's access (and its per-enrollment billing) and leaves no bank
// credential in the database.
//
// Self-contained on purpose: plain Node plus @supabase/supabase-js, nothing
// from lib/, so it keeps working after the Teller code is deleted. The decrypt,
// mTLS, revoke and "already gone" logic are copied from the removed
// lib/teller.ts (deleteEnrollment / isEnrollmentAlreadyGone).
//
// Usage:
//   node --env-file=.env.local scripts/teller-revoke-all.mjs            dry run (the default)
//   node --env-file=.env.local scripts/teller-revoke-all.mjs --apply    revoke at Teller + wipe tokens
//
// Dry run: reads the enrollments and prints one line per enrollment (institution,
// status, last synced) and what --apply WOULD do. It makes no call to Teller and
// no database write. A token is never printed, in either mode.
//
// --apply, per enrollment:
//   1. DELETE https://api.teller.io/accounts with that enrollment's token (mTLS).
//      Teller: this "effectively deletes the enrollment" and cancels its billing.
//      Success is 204. https://teller.io/docs/api/accounts
//   2. ONLY when Teller confirms (2xx) or says the enrollment is already gone
//      (403, 410, or 404 without an `enrollment.disconnected*` code):
//        teller_enrollments.access_token = 'revoked'   (the column is NOT NULL)
//        teller_enrollments.status       = 'disconnected'
//        financial_accounts.teller_enrollment_id = NULL, teller_account_id = NULL
//          for the accounts linked to that enrollment
//   3. Any other result leaves that row untouched and is reported as FAILED.
//   Exit code is non-zero if anything failed. Safe to re-run: rows already wiped
//   are not sent to Teller again.
//
// Env (the same names the app used):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   service-role client (bypasses RLS)
//   TELLER_ENCRYPTION_KEY                                 64 hex chars; decrypts access_token
//   TELLER_CERT + TELLER_KEY                              base64 PEM contents, or
//   TELLER_CERT_PATH + TELLER_KEY_PATH                    file paths (these win when CERT_PATH is set)
//
// Tables and columns are kept (shared database, additive-only rule). Nothing is
// deleted; transactions and accounts stay as they are.

import { createDecipheriv } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import https from 'node:https';
import { pathToFileURL } from 'node:url';

const API_BASE = 'https://api.teller.io';
const REVOKED_SENTINEL = 'revoked';

// ── Token decryption (AES-256-GCM, as lib/teller.ts decryptToken) ─────────────
// Stored format: hex of iv (12 bytes) + ciphertext + auth tag (16 bytes).

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

export function getEncryptionKey(env = process.env) {
  const hex = env.TELLER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('TELLER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function decryptToken(hex, key) {
  const buf = Buffer.from(hex, 'hex');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

// ── mTLS agent (as lib/teller.ts getTlsAgent) ────────────────────────────────

/**
 * Returns `{ agent, source }`. `agent` is undefined when no certificate is
 * configured (lib/teller.ts treats that as sandbox mode). `source` names the
 * env vars used, never their values.
 */
export function buildTlsAgent(env = process.env, readFile = readFileSync) {
  const certPath = env.TELLER_CERT_PATH;
  const keyPath = env.TELLER_KEY_PATH;

  // Deployed style: cert/key passed as base64 env vars.
  if (!certPath && env.TELLER_CERT && env.TELLER_KEY) {
    return {
      agent: new https.Agent({
        cert: Buffer.from(env.TELLER_CERT, 'base64'),
        key: Buffer.from(env.TELLER_KEY, 'base64'),
      }),
      source: 'TELLER_CERT / TELLER_KEY (base64)',
    };
  }

  if (!certPath || !keyPath) return { agent: undefined, source: null };

  // Local style: load from file paths.
  return {
    agent: new https.Agent({ cert: readFile(certPath), key: readFile(keyPath) }),
    source: 'TELLER_CERT_PATH / TELLER_KEY_PATH (files)',
  };
}

// ── Teller request (as lib/teller.ts tellerFetch + deleteEnrollment) ─────────

function authHeaders(accessToken) {
  const encoded = Buffer.from(`${accessToken}:`).toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
    'Teller-Version': '2020-10-12',
  };
}

const REQUEST_TIMEOUT_MS = 30_000;

function requestOnce(url, init, agent) {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: init.method || 'GET',
        headers: init.headers,
        agent,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const retryAfter = res.headers['retry-after'];
          resolve({
            status: res.statusCode,
            retryAfter: Array.isArray(retryAfter) ? retryAfter[0] : retryAfter,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`no response from Teller within ${REQUEST_TIMEOUT_MS / 1000}s`));
    });
    req.on('error', reject);
    req.end();
  });
}

const MAX_ATTEMPTS = 3;
const MAX_RETRY_WAIT_MS = 5_000;
const BASE_BACKOFF_MS = 500;

/**
 * How long to wait before retrying an HTTP 429, or null to stop retrying.
 * `attempt` is the 1-based number of the attempt that just got the 429.
 */
export function retryDelayMs(attempt, retryAfter, nowMs = Date.now(), random = Math.random) {
  if (attempt >= MAX_ATTEMPTS) return null;

  const header = retryAfter?.trim();
  if (header) {
    let waitMs = null;
    if (/^\d+$/.test(header)) {
      waitMs = Number(header) * 1000;
    } else {
      const at = Date.parse(header);
      if (!Number.isNaN(at)) waitMs = Math.max(0, at - nowMs);
    }
    if (waitMs !== null) return waitMs > MAX_RETRY_WAIT_MS ? null : waitMs;
  }

  const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  return Math.min(backoff + Math.floor(random() * 250), MAX_RETRY_WAIT_MS);
}

/** Teller's `error.code` from a response body, or null. Body: { error: { code, message } }. */
export function readErrorCode(body) {
  try {
    const code = JSON.parse(body)?.error?.code;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

/**
 * True when a failed revoke means the enrollment is already gone at Teller, so
 * there is nothing left to revoke or bill (https://teller.io/docs/api/errors):
 *   - 403 "A request was made with an invalid or revoked access token."
 *   - 404 "The requested resource was not found." EXCEPT codes starting with
 *     `enrollment.disconnected`: that enrollment still exists, so it is not gone.
 *   - 410 "the resource requested is no longer available and that condition is permanent"
 */
export function isEnrollmentAlreadyGone(status, code) {
  if (status === 403 || status === 410) return true;
  if (status === 404) return !code?.startsWith('enrollment.disconnected');
  return false;
}

/** Turns a Teller response into `{ outcome: 'revoked' | 'already_gone' | 'failed', status, code }`. */
export function classifyRevokeResponse(status, body) {
  if (status >= 200 && status < 300) return { outcome: 'revoked', status, code: null };
  const code = readErrorCode(body);
  if (isEnrollmentAlreadyGone(status, code)) return { outcome: 'already_gone', status, code };
  return { outcome: 'failed', status, code };
}

/** Revokes one enrollment: `DELETE /accounts`, retrying HTTP 429 with backoff. */
export async function revokeAtTeller(accessToken, agent) {
  for (let attempt = 1; ; attempt++) {
    const res = await requestOnce(
      `${API_BASE}/accounts`,
      { method: 'DELETE', headers: authHeaders(accessToken) },
      agent,
    );
    if (res.status === 429) {
      const waitMs = retryDelayMs(attempt, res.retryAfter);
      if (waitMs !== null) {
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
    }
    return classifyRevokeResponse(res.status, res.body);
  }
}

// ── Database access ──────────────────────────────────────────────────────────

/** Wraps a Supabase service-role client in the four calls this script needs. */
export function createStore(db) {
  return {
    async listEnrollments() {
      const { data, error } = await db
        .from('teller_enrollments')
        .select('id, access_token, institution_name, status, last_synced_at, created_at')
        .order('created_at', { ascending: true });
      if (error) throw new Error(`Could not read teller_enrollments: ${error.message}`);
      return data ?? [];
    },

    /** Accounts that still carry a Teller link of either kind. */
    async listTellerAccounts() {
      const { data, error } = await db
        .from('financial_accounts')
        .select('id, teller_enrollment_id, teller_account_id')
        .or('teller_enrollment_id.not.is.null,teller_account_id.not.is.null');
      if (error) throw new Error(`Could not read financial_accounts: ${error.message}`);
      return data ?? [];
    },

    /** Overwrites the stored token and marks the enrollment disconnected. */
    async wipeEnrollment(enrollmentRowId) {
      const { data, error } = await db
        .from('teller_enrollments')
        .update({ access_token: REVOKED_SENTINEL, status: 'disconnected' })
        .eq('id', enrollmentRowId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error('no row was updated');
    },

    /** Clears the Teller link on that enrollment's accounts. Returns how many changed. */
    async unlinkAccounts(enrollmentRowId) {
      const { data, error } = await db
        .from('financial_accounts')
        .update({ teller_enrollment_id: null, teller_account_id: null })
        .eq('teller_enrollment_id', enrollmentRowId)
        .select('id');
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    },
  };
}

// ── The run ──────────────────────────────────────────────────────────────────

function describe(row, index, linkedCount) {
  const name = row.institution_name || '(no institution name)';
  const synced = row.last_synced_at || 'never';
  return `${String(index + 1).padStart(2)}. ${name} | status: ${row.status} | last synced: ${synced} | linked accounts: ${linkedCount}`;
}

function httpLabel(result) {
  return `HTTP ${result.status}${result.code ? ` (${result.code})` : ''}`;
}

/**
 * @param {object} deps
 * @param {ReturnType<typeof createStore>} deps.store
 * @param {boolean} deps.apply            false = dry run
 * @param {Buffer|null} deps.key          decryption key, or null when it could not be loaded
 * @param {(token: string) => Promise<{outcome: string, status: number, code: string|null}>} deps.revoke
 * @param {(line: string) => void} deps.log
 * @returns {Promise<{total:number, revoked:number, alreadyGone:number, alreadyWiped:number, failed:number}>}
 */
export async function run({ store, apply, key, revoke, log }) {
  const enrollments = await store.listEnrollments();
  const accounts = await store.listTellerAccounts();

  const linkedCount = new Map();
  for (const a of accounts) {
    if (!a.teller_enrollment_id) continue;
    linkedCount.set(a.teller_enrollment_id, (linkedCount.get(a.teller_enrollment_id) ?? 0) + 1);
  }

  const summary = { total: enrollments.length, revoked: 0, alreadyGone: 0, alreadyWiped: 0, failed: 0 };
  log(`Enrollments found: ${enrollments.length}`);

  for (const [i, row] of enrollments.entries()) {
    const linked = linkedCount.get(row.id) ?? 0;
    const head = describe(row, i, linked);

    // Already wiped by an earlier run: never contact Teller again for this row.
    if (row.access_token === REVOKED_SENTINEL) {
      if (!apply) {
        log(`${head} | token already wiped; WOULD skip Teller and make sure status is disconnected and ${linked} account(s) are unlinked`);
        summary.alreadyWiped++;
        continue;
      }
      try {
        await store.wipeEnrollment(row.id);
        const unlinked = await store.unlinkAccounts(row.id);
        log(`${head} | token already wiped; skipped Teller; status set to disconnected; ${unlinked} account(s) unlinked`);
        summary.alreadyWiped++;
      } catch (err) {
        log(`${head} | token already wiped; FAILED to finish the database cleanup: ${err.message}`);
        summary.failed++;
      }
      continue;
    }

    let token = null;
    if (key) {
      try {
        token = decryptToken(row.access_token, key);
      } catch {
        token = null;
      }
    }
    if (!token) {
      log(
        apply
          ? `${head} | FAILED: the stored token could not be decrypted with TELLER_ENCRYPTION_KEY; row left untouched`
          : `${head} | the stored token CANNOT be decrypted with TELLER_ENCRYPTION_KEY; --apply would fail on this row and leave it untouched`,
      );
      summary.failed++;
      continue;
    }

    if (!apply) {
      log(`${head} | token decrypts; WOULD revoke at Teller (DELETE /accounts), then set access_token='revoked', status='disconnected' and unlink ${linked} account(s)`);
      continue;
    }

    let result;
    try {
      result = await revoke(token);
    } catch (err) {
      log(`${head} | FAILED: no HTTP result from Teller (${err.message}); row left untouched`);
      summary.failed++;
      continue;
    }

    if (result.outcome === 'failed') {
      log(`${head} | FAILED: ${httpLabel(result)}; not revoked; row left untouched`);
      summary.failed++;
      continue;
    }

    const what = result.outcome === 'revoked' ? 'revoked at Teller' : 'already gone at Teller';
    try {
      await store.wipeEnrollment(row.id);
      const unlinked = await store.unlinkAccounts(row.id);
      log(`${head} | ${httpLabel(result)}: ${what}; token wiped; status set to disconnected; ${unlinked} account(s) unlinked`);
      if (result.outcome === 'revoked') summary.revoked++;
      else summary.alreadyGone++;
    } catch (err) {
      log(`${head} | ${httpLabel(result)}: ${what}, but FAILED to update the database: ${err.message}. Re-run with --apply to finish.`);
      summary.failed++;
    }
  }

  const orphans = accounts.filter((a) => !a.teller_enrollment_id && a.teller_account_id).length;
  if (orphans > 0) {
    log(`Note: ${orphans} account(s) keep a teller_account_id with no enrollment link (from an earlier disconnect). This script leaves them as they are; the id is not a credential.`);
  }

  return summary;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const known = new Set(['--apply']);
  const unknown = process.argv.slice(2).filter((a) => !known.has(a));
  if (unknown.length) {
    console.error(`Unknown argument(s): ${unknown.join(' ')}. The only option is --apply.`);
    return 2;
  }
  const apply = process.argv.includes('--apply');

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/teller-revoke-all.mjs');
    return 2;
  }

  console.log(
    apply
      ? 'Teller revoke: APPLY. Each enrollment is revoked at Teller; its stored token is wiped only once Teller confirms.'
      : 'Teller revoke: DRY RUN. No call to Teller and no database write. Re-run with --apply to revoke.',
  );

  let key = null;
  try {
    key = getEncryptionKey();
    console.log('TELLER_ENCRYPTION_KEY: present (64 characters)');
  } catch {
    console.log('TELLER_ENCRYPTION_KEY: MISSING OR MALFORMED (it must be a 64-char hex string, 32 bytes)');
  }

  let tls = { agent: undefined, source: null };
  try {
    tls = buildTlsAgent();
    console.log(`Teller client certificate: ${tls.source ?? 'NOT CONFIGURED'}`);
  } catch (err) {
    console.log(`Teller client certificate: could not be loaded (${err.message})`);
  }

  if (apply && (!key || !tls.agent)) {
    // Without the certificate Teller cannot identify this application, and an
    // error answer could be mistaken for "already revoked". Stop before any call.
    console.error('Refusing to --apply: the encryption key and the client certificate (TELLER_CERT + TELLER_KEY, or TELLER_CERT_PATH + TELLER_KEY_PATH) are both required. Nothing was changed.');
    return 2;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const summary = await run({
    store: createStore(db),
    apply,
    key,
    revoke: (token) => revokeAtTeller(token, tls.agent),
    log: (line) => console.log(line),
  });

  console.log('');
  if (apply) {
    console.log(
      `Summary: ${summary.total} enrollment(s). Revoked: ${summary.revoked}. Already gone at Teller: ${summary.alreadyGone}. Already wiped earlier: ${summary.alreadyWiped}. FAILED: ${summary.failed}.`,
    );
    if (summary.failed > 0) {
      console.log('Some enrollments were NOT revoked. Their rows are unchanged. Fix the cause and re-run with --apply, or revoke them in the Teller dashboard.');
    } else {
      console.log('All enrollments are revoked and no token remains. Confirm in the Teller dashboard that 0 enrollments are left.');
    }
  } else {
    const ready = summary.total - summary.alreadyWiped - summary.failed;
    console.log(
      `Summary (dry run): ${summary.total} enrollment(s). Ready to revoke: ${ready}. Already wiped: ${summary.alreadyWiped}. Would fail: ${summary.failed}. Nothing was changed.`,
    );
  }
  return summary.failed > 0 ? 1 : 0;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(`Stopped: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    },
  );
}
