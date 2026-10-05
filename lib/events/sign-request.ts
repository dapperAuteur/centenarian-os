// lib/events/sign-request.ts
// Sender half of the WitUS signed-request contract, for server-to-server calls
// CentenarianOS makes to sibling apps (RideWitUS first). The receiver half is
// lib/events/verify-signature.ts; both speak the same wire format:
//
//   X-Witus-Source:    <source-slug>
//   X-Witus-Timestamp: <unix seconds>
//   X-Witus-Signature: sha256=<hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))>
//
// SIGNED GET REQUESTS
// A GET has no body, and signing an empty string would leave the query (and so
// the `witus_sub` that picks whose data comes back) open to editing. For a GET
// the signed "body" is the request's path plus query string exactly as sent,
// e.g. `/api/v1/ride/vendors?witus_sub=abc&q=shell`. signedGetBody() builds it
// on both sides, so sender and receiver agree byte for byte.
//
// Dependency-free apart from node:crypto and the runtime fetch (injectable for
// tests), with no '@/' imports, so node --test loads it.

import { createHmac } from 'node:crypto';

export interface SignedHeaders {
  'Content-Type': 'application/json';
  'X-Witus-Source': string;
  'X-Witus-Timestamp': string;
  'X-Witus-Signature': string;
}

/** hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`)) */
export function witusSignature(secret: string, timestamp: string | number, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

/** The three X-Witus-* headers (plus Content-Type) for `rawBody`. */
export function signedHeaders(args: {
  secret: string;
  source: string;
  rawBody: string;
  nowSeconds?: number;
}): SignedHeaders {
  const timestamp = String(args.nowSeconds ?? Math.floor(Date.now() / 1000));
  return {
    'Content-Type': 'application/json',
    'X-Witus-Source': args.source,
    'X-Witus-Timestamp': timestamp,
    'X-Witus-Signature': `sha256=${witusSignature(args.secret, timestamp, args.rawBody)}`,
  };
}

/** What a GET request signs: its path and query string, exactly as sent. */
export function signedGetBody(url: URL | { pathname: string; search: string }): string {
  return `${url.pathname}${url.search}`;
}

export type FetchLike = (input: string, init: {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface SendSignedResult {
  ok: boolean;
  /** HTTP status, or 0 when the request never got an answer (network error, timeout). */
  status: number;
  /** The parsed JSON answer, when there was one. */
  body: unknown;
  /** A short reason when ok is false. Never contains the secret or the signature. */
  error?: string;
}

/**
 * POST `payload` as JSON, signed. The bytes signed are the bytes sent: the body
 * is serialized once and never re-serialized.
 */
export async function postSigned(args: {
  url: string;
  secret: string;
  source: string;
  payload: unknown;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  nowSeconds?: number;
}): Promise<SendSignedResult> {
  const rawBody = JSON.stringify(args.payload);
  const headers = signedHeaders({ secret: args.secret, source: args.source, rawBody, nowSeconds: args.nowSeconds });
  const doFetch = args.fetchImpl ?? (fetch as unknown as FetchLike);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 8000);
  try {
    const res = await doFetch(args.url, {
      method: 'POST',
      headers: { ...headers },
      body: rawBody,
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) return { ok: false, status: res.status, body, error: `http_${res.status}` };
    return { ok: true, status: res.status, body };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { ok: false, status: 0, body: null, error: aborted ? 'timeout' : 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}
