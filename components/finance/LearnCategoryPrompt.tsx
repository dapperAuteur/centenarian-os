'use client';

// components/finance/LearnCategoryPrompt.tsx
// The "ask each time" prompt for learned vendor categories. Shown inline, never
// as a modal, after someone sets or changes a transaction's category:
//
//   Always categorize 'CHIPOTLE' as Dining?   [Always]  [Just this once]
//
// It first checks the vendor's current learned category and shows nothing when
// it already matches. "Always" saves the category on the vendor's contact
// (creating the contact if needed), then offers to update the vendor's past
// transactions, with the count shown before anything changes. "Just this once"
// changes nothing else.

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { offlineFetch, isQueuedResponse } from '@/lib/offline/offline-fetch';
import { vendorKey } from '@/lib/finance/transaction-matching';

export interface LearnCategoryRequest {
  vendor: string;
  type: 'expense' | 'income';
  categoryId: string;
}

interface LearnCategoryPromptProps extends LearnCategoryRequest {
  categoryName: string;
  onClose: () => void;
  /** Called after past transactions were updated, so the page can reload. */
  onPastApplied?: () => void;
}

type Phase =
  | { name: 'checking' }
  | { name: 'ask' }
  | { name: 'saving' }
  | { name: 'offer-past'; uncategorized: string[]; other: string[] }
  | { name: 'applying' }
  | { name: 'done'; message: string };

/** POST /api/finance/transactions/bulk accepts at most this many IDs per request. */
const BULK_LIMIT = 200;

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

const primaryButton =
  'min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5';
const secondaryButton =
  'min-h-11 px-4 rounded-lg border border-sky-200 bg-white text-sky-800 text-sm font-medium hover:bg-sky-100 disabled:opacity-50 transition';

export default function LearnCategoryPrompt({
  vendor,
  type,
  categoryId,
  categoryName,
  onClose,
  onPastApplied,
}: LearnCategoryPromptProps) {
  const [phase, setPhase] = useState<Phase>({ name: 'checking' });
  const [error, setError] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const displayVendor = vendor.trim();

  // Only ask when the vendor has no learned category or a different one.
  useEffect(() => {
    let cancelled = false;
    if (!vendorKey(displayVendor) || !categoryId) {
      onCloseRef.current();
      return;
    }
    const params = new URLSearchParams({ vendor: displayVendor, type });
    offlineFetch(`/api/finance/learned-categories?${params}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) { onCloseRef.current(); return; }
        const data = await res.json();
        if (cancelled) return;
        if (data.learned_category_id === categoryId) onCloseRef.current();
        else setPhase({ name: 'ask' });
      })
      .catch(() => { if (!cancelled) onCloseRef.current(); });
    return () => { cancelled = true; };
  }, [displayVendor, type, categoryId]);

  const handleAlways = async () => {
    setPhase({ name: 'saving' });
    setError(null);
    try {
      const res = await offlineFetch('/api/finance/learned-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor: displayVendor, type, category_id: categoryId }),
      });
      if (isQueuedResponse(res)) {
        setPhase({
          name: 'done',
          message: `You're offline. "Always" for ‘${displayVendor}’ is queued and will be saved when you reconnect. Past transactions weren't changed.`,
        });
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? `Couldn't save: ${data.error}` : "Couldn't save. Please try again.");
        setPhase({ name: 'ask' });
        return;
      }
      const uncategorized: string[] = data?.past?.uncategorized_ids ?? [];
      const other: string[] = data?.past?.other_ids ?? [];
      if (uncategorized.length + other.length === 0) {
        setPhase({
          name: 'done',
          message: `New transactions from ‘${displayVendor}’ will be filed under ${categoryName}. No past transactions needed changing.`,
        });
      } else {
        setPhase({ name: 'offer-past', uncategorized, other });
      }
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setPhase({ name: 'ask' });
    }
  };

  const applyToPast = async (ids: string[]) => {
    const previous = phase;
    setPhase({ name: 'applying' });
    setError(null);
    try {
      let queued = false;
      for (let i = 0; i < ids.length; i += BULK_LIMIT) {
        const res = await offlineFetch('/api/finance/transactions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ids.slice(i, i + BULK_LIMIT), updates: { category_id: categoryId } }),
        });
        if (isQueuedResponse(res)) { queued = true; continue; }
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(typeof data?.error === 'string' ? data.error : `error ${res.status}`);
        }
      }
      setPhase({
        name: 'done',
        message: queued
          ? `You're offline. Updating ${plural(ids.length, 'past transaction')} is queued and will happen when you reconnect.`
          : `Updated ${plural(ids.length, 'past transaction')} to ${categoryName}.`,
      });
      if (!queued) onPastApplied?.();
    } catch (err) {
      setError(`Couldn't update past transactions: ${err instanceof Error ? err.message : 'unknown error'}.`);
      setPhase(previous);
    }
  };

  if (phase.name === 'checking') return null;

  return (
    <div
      role="region"
      aria-label="Categorize this vendor"
      className="rounded-xl border border-sky-200 bg-sky-50 p-3 sm:p-4 text-sm text-sky-900"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="w-4 h-4 mt-1 shrink-0 text-sky-600" aria-hidden="true" />
        <div className="flex-1 min-w-0 space-y-3" aria-live="polite">
          {(phase.name === 'ask' || phase.name === 'saving') && (
            <>
              <p>
                Always categorize <strong>&lsquo;{displayVendor}&rsquo;</strong> as <strong>{categoryName}</strong>?
              </p>
              <p className="text-xs text-sky-800">
                &ldquo;Always&rdquo; files this vendor&rsquo;s new transactions under {categoryName} automatically,
                including bank syncs, receipt scans, and CSV imports.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={handleAlways} disabled={phase.name === 'saving'} className={primaryButton}>
                  {phase.name === 'saving' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  Always
                </button>
                <button type="button" onClick={onClose} disabled={phase.name === 'saving'} className={secondaryButton}>
                  Just this once
                </button>
              </div>
            </>
          )}

          {phase.name === 'offer-past' && (() => {
            const total = phase.uncategorized.length + phase.other.length;
            return (
              <>
                <p>
                  <Check className="inline w-4 h-4 mr-1 text-sky-600" aria-hidden="true" />
                  New transactions from <strong>&lsquo;{displayVendor}&rsquo;</strong> will be filed under{' '}
                  <strong>{categoryName}</strong>.
                </p>
                <p>
                  Apply {categoryName} to {plural(total, 'past transaction')} from this vendor too?
                  {phase.uncategorized.length > 0 && phase.other.length > 0 && (
                    <span className="block text-xs text-sky-800 mt-1">
                      {phase.uncategorized.length.toLocaleString()} {phase.uncategorized.length === 1 ? 'has' : 'have'} no
                      category; {phase.other.length.toLocaleString()} {phase.other.length === 1 ? 'is' : 'are'} in another
                      category.
                    </span>
                  )}
                  {phase.uncategorized.length === 0 && (
                    <span className="block text-xs text-sky-800 mt-1">
                      All of them are in another category now.
                    </span>
                  )}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => applyToPast([...phase.uncategorized, ...phase.other])}
                    className={primaryButton}
                  >
                    Apply to all {total.toLocaleString()}
                  </button>
                  {phase.uncategorized.length > 0 && phase.other.length > 0 && (
                    <button
                      type="button"
                      onClick={() => applyToPast(phase.uncategorized)}
                      className={secondaryButton}
                    >
                      Only the {phase.uncategorized.length.toLocaleString()} uncategorized
                    </button>
                  )}
                  <button type="button" onClick={onClose} className={secondaryButton}>
                    No thanks
                  </button>
                </div>
              </>
            );
          })()}

          {phase.name === 'applying' && (
            <p role="status" className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Updating past transactions&hellip;
            </p>
          )}

          {phase.name === 'done' && <p>{phase.message}</p>}

          {error && (
            <p role="alert" className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700">
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-sky-700 hover:bg-sky-100 transition"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
