'use client';

// app/dashboard/finance/review/page.tsx
// The finance Review page: everything waiting for a decision, worked out from
// saved data, so nothing is lost when an import or a review is left half done.
//
//   Unfinished imports    saved statement reviews (Resume opens the Import page)
//   Possible transfers    pairs to link, or "Not a transfer" (remembered)
//   Card and loan payments with no other side   choose "Paid from" / "Paid to"
//   Imported rows that match an entry you made  "Same purchase" or "Not the same"
//   Uncategorized         set a category on one row or many
//
// Data: GET /api/finance/review (counts plus one page of every section);
// actions: POST /api/finance/review. Each section pages on its own, 25 at a
// time. After an action the review is loaded again and focus goes back to the
// section's heading. "Run migration 219 first" shows until the saved-answers
// tables exist; the sections still work without it, only "Not a ..." answers
// and saved imports need it.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, Loader2, RefreshCw } from 'lucide-react';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import type { ReviewResponse } from '@/lib/finance/review/server';
import type { DraftSummary } from '@/lib/finance/import-drafts/drafts';
import { REVIEW_MIGRATION_MESSAGE } from '@/lib/finance/review/schema';
import ImportDraftsList from '@/components/finance/import/ImportDraftsList';
import { discardDraft } from '@/components/finance/import/drafts-api';
import {
  ErrorNotice,
  StatusNotice,
  fieldLabel,
  primaryButton,
  secondaryButton,
  textLink,
} from '@/components/finance/import/shared';
import { loadReview } from '@/components/finance/review/api';
import MatchesSection from '@/components/finance/review/MatchesSection';
import PaymentsSection from '@/components/finance/review/PaymentsSection';
import TransfersSection from '@/components/finance/review/TransfersSection';
import UncategorizedSection from '@/components/finance/review/UncategorizedSection';
import type { ActionOutcome, ReviewSectionKey } from '@/components/finance/review/types';

const PAGE_SIZE = 25;

type Offsets = Record<'transfers' | 'payments' | 'matches' | 'uncategorized', number>;
const NO_OFFSETS: Offsets = { transfers: 0, payments: 0, matches: 0, uncategorized: 0 };

const SECTION_LINKS: { key: keyof Offsets; label: string; anchor: string }[] = [
  { key: 'transfers', label: 'Possible transfers', anchor: 'review-transfers-heading' },
  { key: 'payments', label: 'Payments with no other side', anchor: 'review-payments-heading' },
  { key: 'matches', label: 'Matches an entry you made', anchor: 'review-matches-heading' },
  { key: 'uncategorized', label: 'Uncategorized', anchor: 'review-uncategorized-heading' },
];

/** An offset past the end of a list (its last items were just handled) moves back to its last page. */
function clampOffsets(offsets: Offsets, review: ReviewResponse): Offsets | null {
  let changed = false;
  const next = { ...offsets };
  for (const key of Object.keys(offsets) as (keyof Offsets)[]) {
    const total = review.sections[key].total;
    if (offsets[key] > 0 && offsets[key] >= total) {
      next[key] = Math.max(0, Math.floor(Math.max(total - 1, 0) / PAGE_SIZE) * PAGE_SIZE);
      changed = true;
    }
  }
  return changed ? next : null;
}

export default function FinanceReviewPage() {
  useTrackPageView('finance', '/dashboard/finance/review');

  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [offsets, setOffsets] = useState<Offsets>(NO_OFFSETS);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftBusyId, setDraftBusyId] = useState<string | null>(null);

  const headings = {
    transfers: useRef<HTMLHeadingElement>(null),
    payments: useRef<HTMLHeadingElement>(null),
    matches: useRef<HTMLHeadingElement>(null),
    uncategorized: useRef<HTMLHeadingElement>(null),
    drafts: useRef<HTMLHeadingElement>(null),
  };

  const load = useCallback(async (nextOffsets: Offsets, nextRange: { from: string; to: string }) => {
    setLoading(true);
    setLoadError(null);
    let response = await loadReview({ ...nextRange, limit: PAGE_SIZE, offsets: nextOffsets });
    if (response.ok) {
      const clamped = clampOffsets(nextOffsets, response.data);
      if (clamped) {
        setOffsets(clamped);
        response = await loadReview({ ...nextRange, limit: PAGE_SIZE, offsets: clamped });
      }
    }
    setLoading(false);
    if (!response.ok) {
      setLoadError(response.message);
      return;
    }
    setReview(response.data);
  }, []);

  useEffect(() => {
    void load(offsets, range);
  }, [load, offsets, range]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/finance/categories', { cache: 'no-store' });
        if (!response.ok) return;
        const body = (await response.json().catch(() => null)) as { categories?: { id: string; name: string }[] } | null;
        if (Array.isArray(body?.categories)) setCategories(body.categories);
      } catch {
        // Without categories the Uncategorized section can't set one; it says nothing more.
      }
    })();
  }, []);

  const runAction = useCallback(
    async (section: ReviewSectionKey, work: () => Promise<ActionOutcome>) => {
      if (busy) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError("You're offline. Reconnect, then try again.");
        return;
      }
      setBusy(true);
      setStatus(null);
      setError(null);
      try {
        const outcome = await work();
        setStatus(outcome.status ?? null);
        setError(outcome.error ?? null);
        await load(offsets, range);
      } finally {
        setBusy(false);
        headings[section].current?.focus();
      }
    },
    // headings holds stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, load, offsets, range],
  );

  const setSectionOffset = (key: keyof Offsets) => (offset: number) => {
    setOffsets((current) => ({ ...current, [key]: offset }));
    headings[key].current?.focus();
  };

  async function discardSaved(draft: DraftSummary) {
    setDraftBusyId(draft.id);
    setStatus(null);
    setError(null);
    const response = await discardDraft(draft.id);
    setDraftBusyId(null);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setStatus('The saved import was discarded. Nothing from it was imported.');
    await load(offsets, range);
  }

  function applyRange(event: React.FormEvent) {
    event.preventDefault();
    if (from && to && from > to) {
      setError('The start date must not be after the end date.');
      return;
    }
    setError(null);
    setOffsets(NO_OFFSETS);
    setRange({ from, to });
  }

  function clearRange() {
    setFrom('');
    setTo('');
    setOffsets(NO_OFFSETS);
    setRange({ from: '', to: '' });
  }

  const counts = review?.counts;
  const canRemember = review?.saved_answers_available !== false;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-10">
      <header className="flex items-start gap-2">
        <Link
          href="/dashboard/finance"
          aria-label="Back to Finance"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ClipboardCheck className="h-6 w-6 shrink-0 text-fuchsia-600" aria-hidden="true" />
            Review
          </h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Everything in Finance that waits for a decision: imports you didn&rsquo;t finish, possible transfers,
            payments with no other side, imported rows that match an entry you made, and uncategorized transactions.
            It is worked out from your saved data, so you can stop at any time and pick up here.
          </p>
          <nav aria-label="Related" className="mt-1 flex flex-col gap-x-5 sm:flex-row">
            <Link href="/dashboard/finance/import" className={textLink}>
              Import a statement
            </Link>
            <Link href="/dashboard/finance/import/history" className={textLink}>
              Import history and editing
            </Link>
          </nav>
        </div>
      </header>

      <form onSubmit={applyRange} aria-label="Date range" className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="review-from" className={fieldLabel}>
            From
          </label>
          <input
            id="review-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
          />
        </div>
        <div>
          <label htmlFor="review-to" className={fieldLabel}>
            To
          </label>
          <input
            id="review-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
          />
        </div>
        <button type="submit" disabled={loading || busy} className={primaryButton}>
          Show this range
        </button>
        {(range.from || range.to) && (
          <button type="button" onClick={clearRange} disabled={loading || busy} className={secondaryButton}>
            All dates
          </button>
        )}
        <button
          type="button"
          onClick={() => void load(offsets, range)}
          disabled={loading || busy}
          className={secondaryButton}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Check again
        </button>
      </form>

      {loading && !review && (
        <p role="status" className="flex items-center gap-2 text-sm text-gray-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Looking through your transactions...
        </p>
      )}

      {loadError && (
        <ErrorNotice>
          <p>{loadError}</p>
        </ErrorNotice>
      )}

      {error && (
        <ErrorNotice>
          <p>{error}</p>
        </ErrorNotice>
      )}

      {status && (
        <StatusNotice tone="success">
          <p>{status}</p>
        </StatusNotice>
      )}

      {review && !review.saved_answers_available && (
        <StatusNotice tone="attention">
          <p>{REVIEW_MIGRATION_MESSAGE}</p>
          <p>
            Until then everything here can still be linked, merged and categorized, but &ldquo;Not a transfer&rdquo;
            and the like can&rsquo;t be remembered, and imports can&rsquo;t be saved to finish later.
          </p>
        </StatusNotice>
      )}

      {review?.truncated && (
        <StatusNotice tone="attention">
          <p>
            Only your newest 5,000 transactions were checked for transfers, payments and matches. Choose a date range
            above to check older ones. Uncategorized transactions are always counted in full.
          </p>
        </StatusNotice>
      )}

      {counts && (
        <section aria-labelledby="review-summary-heading" className="space-y-2">
          <h2 id="review-summary-heading" className="sr-only">
            Summary
          </h2>
          {counts.total === 0 ? (
            <StatusNotice tone="success">
              <p>Nothing waits for a decision{range.from || range.to ? ' in this date range' : ''}. You&rsquo;re all caught up.</p>
            </StatusNotice>
          ) : (
            <StatusNotice tone="attention">
              <p className="font-medium">
                {counts.total.toLocaleString('en-US')} {counts.total === 1 ? 'item waits' : 'items wait'} for a decision.
              </p>
              <ul className="flex flex-col gap-x-4 sm:flex-row sm:flex-wrap">
                {counts.drafts > 0 && (
                  <li>
                    <a href="#import-drafts-heading" className="inline-flex min-h-11 items-center underline underline-offset-2">
                      Unfinished imports: {counts.drafts.toLocaleString('en-US')}
                    </a>
                  </li>
                )}
                {SECTION_LINKS.filter((link) => counts[link.key] > 0).map((link) => (
                  <li key={link.key}>
                    <a href={`#${link.anchor}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                      {link.label}: {counts[link.key].toLocaleString('en-US')}
                    </a>
                  </li>
                ))}
              </ul>
            </StatusNotice>
          )}
        </section>
      )}

      {review && review.drafts && review.drafts.length > 0 && (
        <ImportDraftsList
          drafts={review.drafts}
          onDiscard={(draft) => void discardSaved(draft)}
          busyId={draftBusyId}
        />
      )}

      {review && (
        <>
          <TransfersSection
            ref={headings.transfers}
            page={review.sections.transfers}
            pageSize={PAGE_SIZE}
            onPage={setSectionOffset('transfers')}
            busy={busy || loading}
            onAction={runAction}
            canRemember={canRemember}
          />
          <PaymentsSection
            ref={headings.payments}
            page={review.sections.payments}
            pageSize={PAGE_SIZE}
            onPage={setSectionOffset('payments')}
            busy={busy || loading}
            onAction={runAction}
            accounts={review.accounts}
            canRemember={canRemember}
          />
          <MatchesSection
            ref={headings.matches}
            page={review.sections.matches}
            pageSize={PAGE_SIZE}
            onPage={setSectionOffset('matches')}
            busy={busy || loading}
            onAction={runAction}
            canRemember={canRemember}
          />
          <UncategorizedSection
            ref={headings.uncategorized}
            page={review.sections.uncategorized}
            pageSize={PAGE_SIZE}
            onPage={setSectionOffset('uncategorized')}
            busy={busy || loading}
            onAction={runAction}
            categories={categories}
          />
        </>
      )}
    </div>
  );
}
