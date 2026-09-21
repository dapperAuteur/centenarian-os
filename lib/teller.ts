// lib/teller.ts
// Server-only — Teller.io bank connection API helpers.
// Docs: https://teller.io/docs/api
// Auth: mTLS (client certificate) + Basic Auth (access token per enrollment).

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { readFileSync } from 'fs';
import https from 'https';

const API_BASE = 'https://api.teller.io';

// ── mTLS Agent ──────────────────────────────────────────────────

let _agent: https.Agent | null = null;

/**
 * Returns an https.Agent configured with the Teller client certificate
 * for mTLS. Required for development/production API calls.
 *
 * Env vars:
 *   TELLER_CERT_PATH — path to certificate.pem
 *   TELLER_KEY_PATH  — path to private_key.pem
 */
/**
 * Resolves cert/key content from either:
 *   1. File paths (local dev): TELLER_CERT_PATH / TELLER_KEY_PATH
 *   2. Inline env vars (production): TELLER_CERT / TELLER_KEY — base64-encoded
 *      certificate contents, written to /tmp at runtime.
 */
function getTlsAgent(): https.Agent | undefined {
  const certPath = process.env.TELLER_CERT_PATH;
  const keyPath = process.env.TELLER_KEY_PATH;

  // Production: cert/key passed as base64 env vars — use content directly (no /tmp write)
  if (!certPath && process.env.TELLER_CERT && process.env.TELLER_KEY) {
    if (!_agent) {
      _agent = new https.Agent({
        cert: Buffer.from(process.env.TELLER_CERT, 'base64'),
        key: Buffer.from(process.env.TELLER_KEY, 'base64'),
      });
    }
    return _agent;
  }

  if (!certPath || !keyPath) {
    // Sandbox mode — no mTLS required
    return undefined;
  }

  // Local dev: load from file paths
  if (!_agent) {
    _agent = new https.Agent({
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    });
  }
  return _agent;
}

// ── Auth headers ────────────────────────────────────────────────

function authHeaders(accessToken: string) {
  const encoded = Buffer.from(`${accessToken}:`).toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
    'Teller-Version': '2020-10-12',
  };
}

interface TellerResponse {
  ok: boolean;
  status: number;
  retryAfter: string | undefined;
  json: () => Promise<unknown>;
}

/** Makes one HTTPS request with the mTLS client certificate. */
function tellerRequestOnce(
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: string },
): Promise<TellerResponse> {
  const agent = getTlsAgent();
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
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          const retryAfter = res.headers['retry-after'];
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            retryAfter: Array.isArray(retryAfter) ? retryAfter[0] : retryAfter,
            json: () => Promise.resolve(JSON.parse(body)),
          });
        });
      },
    );
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

// ── Rate limits (HTTP 429) ──────────────────────────────────────
// Teller: "If your application triggers rate limits, Teller will respond with
// an HTTP 429 status code. Your system should back off and retry after an
// appropriate delay." Thresholds are not published.
// https://teller.io/docs/api (Rate Limits). Teller does not document a
// Retry-After header; it is honored here only if one is sent.

/** Total tries per request, including the first. */
export const TELLER_MAX_ATTEMPTS = 3;
/** Longest single wait. A longer Retry-After means "give up now", not "retry early". */
export const TELLER_MAX_RETRY_WAIT_MS = 5_000;
const TELLER_BASE_BACKOFF_MS = 500;

/**
 * How long to wait before retrying a 429, or null to stop retrying.
 * `attempt` is the 1-based number of the attempt that just got the 429.
 */
export function tellerRetryDelayMs(
  attempt: number,
  retryAfter: string | undefined,
  nowMs: number = Date.now(),
  random: () => number = Math.random,
): number | null {
  if (attempt >= TELLER_MAX_ATTEMPTS) return null;

  const header = retryAfter?.trim();
  if (header) {
    let waitMs: number | null = null;
    if (/^\d+$/.test(header)) {
      waitMs = Number(header) * 1000; // delta-seconds
    } else {
      const at = Date.parse(header); // HTTP-date
      if (!Number.isNaN(at)) waitMs = Math.max(0, at - nowMs);
    }
    if (waitMs !== null) {
      return waitMs > TELLER_MAX_RETRY_WAIT_MS ? null : waitMs;
    }
  }

  // Exponential backoff with jitter: ~500ms, then ~1s.
  const backoff = TELLER_BASE_BACKOFF_MS * 2 ** (attempt - 1);
  return Math.min(backoff + Math.floor(random() * 250), TELLER_MAX_RETRY_WAIT_MS);
}

/** Makes a Teller request, retrying HTTP 429 with backoff. Other statuses return as-is. */
async function tellerFetch(
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: string },
): Promise<TellerResponse> {
  for (let attempt = 1; ; attempt++) {
    const res = await tellerRequestOnce(url, init);
    if (res.status !== 429) return res;

    const waitMs = tellerRetryDelayMs(attempt, res.retryAfter);
    if (waitMs === null) return res;
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

// ── Errors ──────────────────────────────────────────────────────

/**
 * A non-2xx Teller response. `code` is Teller's `error.code` when the body has one,
 * e.g. "enrollment.disconnected.credentials_invalid".
 * Body shape: { "error": { "code": string, "message": string } }
 * https://teller.io/docs/api/errors
 */
export class TellerApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'TellerApiError';
    this.status = status;
    this.code = code;
  }
}

async function readErrorCode(res: TellerResponse): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: { code?: unknown } } | null;
    const code = body?.error?.code;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

async function toTellerError(label: string, res: TellerResponse): Promise<TellerApiError> {
  const code = await readErrorCode(res);
  return new TellerApiError(
    `Teller ${label} failed: ${res.status}${code ? ` (${code})` : ''}`,
    res.status,
    code,
  );
}

// ── Token encryption (AES-256-GCM) ─────────────────────────────

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getEncryptionKey(): Buffer {
  const hex = process.env.TELLER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('TELLER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypts a plaintext token. Returns hex string: iv + ciphertext + authTag. */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('hex');
}

/** Decrypts a hex string produced by encryptToken. */
export function decryptToken(hex: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(hex, 'hex');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

// ── Teller API types ────────────────────────────────────────────

export interface TellerAccount {
  id: string;
  enrollment_id: string;
  institution: { id: string; name: string };
  name: string;
  type: string; // depository, credit
  subtype: string; // checking, savings, credit_card
  currency: string;
  last_four: string;
  status: string;
}

export interface TellerTransaction {
  id: string;
  account_id: string;
  date: string; // YYYY-MM-DD
  amount: string; // signed decimal string (negative = debit)
  description: string;
  type: string;
  status: string; // pending, posted
  running_balance: string | null;
  details: {
    processing_status: string;
    category?: string;
    counterparty?: { name: string; type: string };
  };
}

export interface TellerBalance {
  account_id: string;
  available: string;
  ledger: string;
}

// ── API calls ───────────────────────────────────────────────────

export async function listAccounts(accessToken: string): Promise<TellerAccount[]> {
  const res = await tellerFetch(`${API_BASE}/accounts`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw await toTellerError('listAccounts', res);
  return res.json() as Promise<TellerAccount[]>;
}

/**
 * BILLED PER CALL in production: Teller's Balance product is priced per API call
 * (https://teller.io/, pricing). Not called anywhere today. Never call it from an
 * automatic path (sync, webhook, cron) without a cost decision.
 */
export async function getAccountBalances(
  accessToken: string,
  accountId: string,
): Promise<TellerBalance> {
  const res = await tellerFetch(`${API_BASE}/accounts/${accountId}/balances`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw await toTellerError('getBalances', res);
  return res.json() as Promise<TellerBalance>;
}

interface ListTransactionsOpts {
  count?: number;
  fromId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

/**
 * Fetches transactions from Teller for a specific account.
 * On initial sync (no startDate), fetches all available history.
 * Banks typically provide 90 days to 2+ years of history.
 */
export async function listTransactions(
  accessToken: string,
  accountId: string,
  opts?: ListTransactionsOpts,
): Promise<TellerTransaction[]> {
  const params = new URLSearchParams();
  if (opts?.count) params.set('count', String(opts.count));
  if (opts?.fromId) params.set('from_id', opts.fromId);
  if (opts?.startDate) params.set('start_date', opts.startDate);
  if (opts?.endDate) params.set('end_date', opts.endDate);

  const qs = params.toString();
  const url = `${API_BASE}/accounts/${accountId}/transactions${qs ? `?${qs}` : ''}`;

  const res = await tellerFetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) throw await toTellerError('listTransactions', res);
  return res.json() as Promise<TellerTransaction[]>;
}

/**
 * True when a failed revoke means the enrollment is already gone at Teller, so
 * there is nothing left to revoke or bill (https://teller.io/docs/api/errors):
 *   - 403 "A request was made with an invalid or revoked access token."
 *   - 404 "The requested resource was not found." EXCEPT codes starting with
 *     `enrollment.disconnected`: that enrollment still exists and can be
 *     repaired through Teller Connect, so it is not gone.
 *   - 410 "the resource requested is no longer available and that condition is permanent"
 */
export function isEnrollmentAlreadyGone(status: number, code: string | null): boolean {
  if (status === 403 || status === 410) return true;
  if (status === 404) return !code?.startsWith('enrollment.disconnected');
  return false;
}

/**
 * Revokes the whole enrollment: `DELETE /accounts`.
 * Teller: "This deletes your application's authorization to access any account in
 * the enrollment, i.e. effectively deletes the enrollment ... Removing access will
 * cancel billing for subscription billed products associated with the enrollment,
 * e.g. transactions." Success is 204 No Content. https://teller.io/docs/api/accounts
 *
 * Resolves `{ alreadyGone: true }` when Teller says the token or enrollment no
 * longer exists. Throws TellerApiError for anything else, so the caller must NOT
 * treat the bank as disconnected.
 */
export async function deleteEnrollment(accessToken: string): Promise<{ alreadyGone: boolean }> {
  const res = await tellerFetch(`${API_BASE}/accounts`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (res.ok) return { alreadyGone: false };

  const err = await toTellerError('revoke (DELETE /accounts)', res);
  if (isEnrollmentAlreadyGone(err.status, err.code)) return { alreadyGone: true };
  throw err;
}

// ── Mappers ─────────────────────────────────────────────────────

/** Maps a Teller account subtype to the app's account_type. */
export function mapAccountType(subtype: string): string {
  switch (subtype) {
    case 'checking': return 'checking';
    case 'savings': return 'savings';
    case 'credit_card': return 'credit_card';
    case 'money_market': return 'savings';
    default: return 'checking';
  }
}

/** Maps a Teller transaction to a financial_transactions insert shape. */
export function mapTellerTransaction(
  txn: TellerTransaction,
  accountId: string,
  userId: string,
) {
  // Teller amounts: negative = money out (expense), positive = money in (income)
  const numAmount = parseFloat(txn.amount);
  const isExpense = numAmount < 0;

  return {
    user_id: userId,
    account_id: accountId,
    teller_transaction_id: txn.id,
    amount: Math.abs(numAmount),
    type: isExpense ? 'expense' : 'income',
    description: txn.description,
    vendor: txn.details?.counterparty?.name ?? txn.description,
    transaction_date: txn.date,
    source: 'bank_sync' as const,
    notes: txn.details?.category
      ? `Category: ${txn.details.category}`
      : null,
  };
}
