// components/finance/review/http.ts
// One request helper for the finance Review page, saved imports and Import
// history. Every call resolves (never throws) to either the data or a sentence
// that is safe to show, worded by the statement import's own rules
// (importErrorText), with the server's `code` for the page to branch on
// (e.g. 'review_migration_required' -> "Run migration 219 first").
//
// Plain fetch, not offlineFetch: none of these may be queued offline and
// replayed later.

import { NETWORK_ERROR_TEXT, importErrorText } from '@/lib/finance/csv-import/ui-helpers';

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code: string; status: number };

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: 'no-store' });
  } catch {
    return { ok: false, message: NETWORK_ERROR_TEXT, code: 'network', status: 0 };
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: importErrorText words it from the status.
  }
  if (!response.ok) {
    const code =
      typeof body === 'object' && body !== null && typeof (body as { code?: unknown }).code === 'string'
        ? (body as { code: string }).code
        : '';
    return { ok: false, message: importErrorText(response.status, body), code, status: response.status };
  }
  return { ok: true, data: body as T };
}

export function sendJson<T>(url: string, method: 'POST' | 'PATCH' | 'DELETE', payload?: unknown): Promise<ApiResult<T>> {
  return apiRequest<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}
