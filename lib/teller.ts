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

/** Makes an HTTPS request with mTLS client certificate. */
async function tellerFetch(
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: string },
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
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
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
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
  if (!res.ok) throw new Error(`Teller listAccounts failed: ${res.status}`);
  return res.json() as Promise<TellerAccount[]>;
}

export async function getAccountBalances(
  accessToken: string,
  accountId: string,
): Promise<TellerBalance> {
  const res = await tellerFetch(`${API_BASE}/accounts/${accountId}/balances`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`Teller getBalances failed: ${res.status}`);
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
  if (!res.ok) throw new Error(`Teller listTransactions failed: ${res.status}`);
  return res.json() as Promise<TellerTransaction[]>;
}

export async function deleteEnrollment(accessToken: string): Promise<void> {
  const res = await tellerFetch(`${API_BASE}/`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Teller deleteEnrollment failed: ${res.status}`);
  }
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
