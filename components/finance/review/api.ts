// components/finance/review/api.ts
// The finance Review page's requests (app/api/finance/review/**). Every call
// resolves to the data or a sentence that is safe to show (./http.ts).

import type { ActionFailure, LinkPaymentsResult, LinkPairsResult, MergeResult } from '@/lib/finance/review/actions';
import type { DismissalSection } from '@/lib/finance/review/sections';
import type { ReviewCounts, ReviewResponse } from '@/lib/finance/review/server';
import { apiRequest, sendJson, type ApiResult } from './http';

export type { ActionFailure };

export interface ReviewQuery {
  from?: string;
  to?: string;
  limit?: number;
  offsets?: Partial<Record<'transfers' | 'payments' | 'matches' | 'uncategorized', number>>;
}

export function loadReview(query: ReviewQuery = {}): Promise<ApiResult<ReviewResponse>> {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.limit) params.set('limit', String(query.limit));
  for (const [section, offset] of Object.entries(query.offsets ?? {})) {
    if (offset) params.set(`${section}_offset`, String(offset));
  }
  const search = params.toString();
  return apiRequest(`/api/finance/review${search ? `?${search}` : ''}`);
}

export function loadReviewCounts(): Promise<ApiResult<ReviewCounts>> {
  return apiRequest('/api/finance/review/summary');
}

const act = <T,>(payload: Record<string, unknown>): Promise<ApiResult<T>> => sendJson<T>('/api/finance/review', 'POST', payload);

export const linkPairs = (pairs: { from_id: string; to_id: string }[]) =>
  act<LinkPairsResult>({ action: 'link_pairs', pairs });

export const linkPayments = (items: { transaction_id: string; account_id: string }[], recordMissing: boolean) =>
  act<LinkPaymentsResult>({ action: 'link_payments', items, record_missing: recordMissing });

export const mergeMatches = (pairs: { imported_id: string; entry_id: string }[]) =>
  act<MergeResult>({ action: 'merge_matches', pairs });

export const dismiss = (items: { section: DismissalSection; transaction_id: string; other_transaction_id?: string | null }[]) =>
  act<{ dismissed: number }>({ action: 'dismiss', items });

export const restore = (sections: DismissalSection[]) => act<{ restored: number }>({ action: 'restore', sections });

export const categorize = (ids: string[], categoryId: string | null) =>
  act<{ updated: number }>({ action: 'categorize', ids, category_id: categoryId });

/** The Possible transfers panel's saved "Not a transfer" keys ("pair:<from>:<to>", "one:<id>"). */
export function loadPanelDismissals(): Promise<ApiResult<{ keys: string[]; available: boolean }>> {
  return apiRequest('/api/finance/review/dismissals');
}

/** "3 transfers" / "1 transfer". */
export function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

/** The first few failures, as one sentence. */
export function failureText(failures: readonly ActionFailure[]): string {
  if (failures.length === 0) return '';
  const shown = failures.slice(0, 3).map((failure) => failure.reason);
  const more = failures.length > shown.length ? ` And ${failures.length - shown.length} more.` : '';
  return `${plural(failures.length, 'item was', 'items were')} not changed: ${shown.join(' ')}${more}`;
}
