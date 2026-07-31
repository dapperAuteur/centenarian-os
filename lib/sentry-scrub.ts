// lib/sentry-scrub.ts
// Sentry `beforeSend` scrubber.
//
// Why this file exists
// --------------------
// This app stores HEALTH data. A crash report is a copy of whatever the app was
// holding at the moment it broke, shipped to a third party. So the report has to
// carry the SIGNAL (what broke, where, in which build) and none of the identity:
// no email, no Supabase user id, no session cookie, no bearer token, no request
// body. An over-redacted report costs a few minutes of triage. An under-redacted
// one leaks somebody's medical history, or hands a reader of the error inbox a
// working credential.
//
// The bias is therefore REDACT WHEN UNSURE, and the scrubber never returns null:
// we still want to know the app crashed, just not who it crashed for.
//
// Pure and self-contained on purpose. It runs inside the error path on all three
// runtimes (node, edge, browser), so it must not import the Supabase client, the
// logger, or anything else that could itself be the thing that is broken.

import type { ErrorEvent } from '@sentry/nextjs';

const REDACTED = '[redacted]';
const REDACTED_EMAIL = '[redacted email]';
const REDACTED_URL = '[redacted url]';

/** Absolute http(s) URLs. Trailing punctuation is excluded so we rewrite the URL
 *  and not the prose around it. */
const URL_RE = /https?:\/\/[^\s<>"')\]}]+/g;

/** Email addresses anywhere in free text. In this app an email IS the account. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** JWT-shaped strings. Supabase access/refresh tokens and our own WitUS handoff
 *  tokens all land here, and every one of them is a working credential. */
const JWT_RE = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g;

/** Vendor key prefixes this repo actually uses: Supabase (new format), Stripe,
 *  Resend, Shopify. Cheap to check, and each match is a live secret. */
const VENDOR_KEY_RE =
  /\b(sb_secret_|sb_publishable_|sk_live_|sk_test_|rk_live_|whsec_|shpat_|re_)[A-Za-z0-9_-]{8,}/g;

/** A labelled raw secret in prose: `apikey: abc123`, `password = hunter2`. The
 *  separator is required, so ordinary sentences are left alone. */
const SECRET_LABEL_RE =
  /\b(api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|id[_-]?token|service[_-]?role[_-]?key|anon[_-]?key|bearer|authorization|password|passcode|pin|secret|one[-\s]?time code|verification code)\b\s*(?:is|:|=)\s*(?!\[redacted)([^\s,;'"]{3,})/gi;

/** A path segment long and random enough to be a token, a UUID, or a row id.
 *  Deliberately loose: a human-readable slug is rarely 16+ opaque characters,
 *  and when one is, masking it costs us nothing. */
const TOKENISH_SEGMENT_RE = /^[A-Za-z0-9_-]{16,}$/;

/** Header names that carry (or plausibly carry) a credential. Substring match. */
const SENSITIVE_HEADER_RE = /(cookie|auth|token|key|secret|session|password|credential)/i;

/**
 * Rewrite a URL down to something safe to send: scheme + host + path, with
 * token-shaped segments masked, and the query string dropped WHOLESALE.
 *
 * Dropping the whole query is the strict choice on purpose. A magic-link token,
 * a Supabase `code`, and a bare `?email=` all live there, and an allowlist of
 * "safe" params is a list somebody eventually forgets to update. Losing
 * `?page=2` off a crash report is a fine price for that.
 */
function maskUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Cannot reason about it, so do not send it. That is the "redact when
    // unsure" rule in its most literal form.
    return REDACTED_URL;
  }
  const path = url.pathname
    .split('/')
    .map((seg) => (TOKENISH_SEGMENT_RE.test(seg) ? '<id>' : seg))
    .join('/');
  const query = url.search || url.hash ? '?<redacted>' : '';
  return `${url.origin}${path}${query}`;
}

/**
 * Remove every identifier and bearer secret from a string. Order matters: URLs
 * are masked first, so anything hiding in a query string is already gone before
 * the email and token passes run over what is left.
 */
export function redactText(input: string): string {
  return input
    .replace(URL_RE, maskUrl)
    .replace(JWT_RE, REDACTED)
    .replace(VENDOR_KEY_RE, REDACTED)
    .replace(EMAIL_RE, REDACTED_EMAIL)
    .replace(SECRET_LABEL_RE, (_match, label: string) => `${label}: ${REDACTED}`);
}

/** Apply redactText to every string value in a shallow record, in place. */
function redactRecord(record: Record<string, unknown> | undefined): void {
  if (!record) return;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') record[key] = redactText(value);
  }
}

/**
 * Sentry `beforeSend`. Returns the event with the identifiers and credentials
 * stripped out, and never null: the crash signal is the whole point.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.message) event.message = redactText(event.message);

  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = redactText(ex.value);
  }

  // Drop the account identity ENTIRELY, not just the obvious PII fields. In this
  // app the Supabase user id joins straight to the health tables, so that id is
  // a patient identifier and not the harmless opaque handle it is elsewhere.
  // The stack trace and the error digest are what triage actually needs.
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
    delete event.user;
  }

  if (event.request) {
    if (typeof event.request.url === 'string') event.request.url = maskUrl(event.request.url);
    // The query string and the request body are where health data and tokens
    // turn up most often. Neither is worth keeping for triage.
    delete event.request.query_string;
    delete event.request.data;
    delete event.request.cookies;

    const headers = event.request.headers as Record<string, string> | undefined;
    if (headers) {
      delete headers.cookie;
      delete headers.authorization;
      delete headers['set-cookie'];
      for (const name of Object.keys(headers)) {
        if (SENSITIVE_HEADER_RE.test(name)) delete headers[name];
      }
      // Referer survives, masked. It says which page the user came from, which
      // is genuinely useful, but it can carry a token in its own query string.
      if (typeof headers.referer === 'string') headers.referer = maskUrl(headers.referer);
      if (typeof headers.referrer === 'string') headers.referrer = maskUrl(headers.referrer);
    }
  }

  // Breadcrumbs replay the fetches and clicks leading up to the crash, so they
  // are full of request URLs. Same treatment.
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = redactText(crumb.message);
    if (crumb.data && typeof crumb.data === 'object') {
      redactRecord(crumb.data as Record<string, unknown>);
    }
  }

  redactRecord(event.extra as Record<string, unknown> | undefined);
  redactRecord(event.tags as unknown as Record<string, unknown> | undefined);

  return event;
}
