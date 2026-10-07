'use client';

// components/finance/FindSimilarPanel.tsx
// "Find similar" on the Transactions page: starting from one transaction (its
// row's button, or ?similar=<id> from the transaction's page) or from a
// search, it finds the person's other transactions that share the details
// ticked here, with a live count, and edits the ones selected in one go:
// category, vendor name, type, brand, life category, tags, transfer unlink.
// Large selections go in batches of 200 with progress, as one edit that
// "Undo last bulk edit" can take back.
//
// Matching runs on the server (POST /api/finance/transactions/similar, rules
// in lib/finance/similar/criteria.ts); the edit goes through
// POST /api/finance/transactions/bulk (lib/finance/bulk-edit).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Check, ChevronLeft, ChevronRight, ExternalLink, Loader2, ScanSearch, X } from 'lucide-react';
import { accountLabel } from '@/lib/finance/transfers/pairing';
import {
  NONE,
  criteriaFromForm,
  formFromSearch,
  formFromTransaction,
  type SimilarForm,
  type SimilarSeedTx,
} from '@/lib/finance/similar/criteria';
import { describeEdit, parseTags, type BulkEditSpec } from '@/lib/finance/bulk-edit/logic';
import { runBulkEdit } from '@/lib/finance/bulk-edit/client';
import { vendorKey } from '@/lib/finance/transaction-matching';
import TxAmount from '@/components/finance/TxAmount';
import BulkEditUndo from '@/components/finance/BulkEditUndo';

export type SimilarSeed =
  | { kind: 'transaction'; tx: SimilarSeedTx & { id: string } }
  | { kind: 'search'; text: string };

interface NamedOption {
  id: string;
  name: string;
}

interface AccountOption {
  id: string;
  name: string;
  institution_name?: string | null;
  last_four?: string | null;
  is_active?: boolean;
}

interface MatchRow {
  id: string;
  amount: number;
  type: 'expense' | 'income';
  description: string | null;
  vendor: string | null;
  transaction_date: string;
  transfer_group_id?: string | null;
  currency?: string | null;
  amount_home?: number | null;
  budget_categories: { name: string; color: string } | null;
  financial_accounts: { name: string; institution_name?: string | null; last_four?: string | null; currency?: string | null } | null;
}

interface MatchResult {
  total: number;
  ids: string[];
  transferCount: number;
  truncated: boolean;
  capped: boolean;
}

interface EditForm {
  category: string;
  brand: string;
  type: '' | 'expense' | 'income';
  vendor: string;
  lifeAdd: string;
  lifeRemove: string;
  tagsAdd: string;
  tagsRemove: string;
  unlink: boolean;
  remember: boolean;
}

interface FindSimilarPanelProps {
  seed: SimilarSeed;
  categories: NamedOption[];
  brands: NamedOption[];
  lifeCategories: NamedOption[];
  accounts: AccountOption[];
  homeCurrency: string;
  onClose: () => void;
  /** Called after an edit or an undo, so the page reloads its list. */
  onChanged: () => void;
}

const PAGE_SIZE = 25;
/** "Leave as is" in the edit pickers. */
const KEEP = '';
const EMPTY_EDIT: EditForm = {
  category: KEEP, brand: KEEP, type: '', vendor: '', lifeAdd: KEEP, lifeRemove: KEEP,
  tagsAdd: '', tagsRemove: '', unlink: false, remember: false,
};

const inputClass = 'w-full min-h-11 px-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 disabled:bg-gray-100';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1';

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

/** The edit form as a spec; null with a reason when it asks for nothing or something invalid. */
function specFromEdit(edit: EditForm): { spec: BulkEditSpec | null; problem: string | null } {
  const tagsAdd = parseTags(edit.tagsAdd);
  const tagsRemove = parseTags(edit.tagsRemove);
  if (!tagsAdd || !tagsRemove) return { spec: null, problem: 'Tags: at most 20, separated by commas.' };
  const spec: BulkEditSpec = {
    tags_add: tagsAdd,
    tags_remove: tagsRemove,
    unlink_transfers: edit.unlink,
    remember: false,
    remember_skip: [],
  };
  if (edit.category !== KEEP) spec.category_id = edit.category === NONE ? null : edit.category;
  if (edit.brand !== KEEP) spec.brand_id = edit.brand === NONE ? null : edit.brand;
  if (edit.type) spec.type = edit.type;
  if (edit.vendor.trim()) spec.vendor = edit.vendor.trim();
  if (edit.lifeAdd !== KEEP) spec.life_add = edit.lifeAdd;
  if (edit.lifeRemove !== KEEP) spec.life_remove = edit.lifeRemove;
  if (spec.life_add && spec.life_add === spec.life_remove) {
    return { spec: null, problem: 'The same life category cannot be added and removed.' };
  }
  spec.remember = edit.remember && Boolean(spec.category_id);
  const asksSomething =
    spec.category_id !== undefined || spec.brand_id !== undefined || spec.type !== undefined || spec.vendor !== undefined ||
    spec.life_add || spec.life_remove || spec.tags_add.length > 0 || spec.tags_remove.length > 0 || spec.unlink_transfers;
  return asksSomething ? { spec, problem: null } : { spec: null, problem: null };
}

export default function FindSimilarPanel({
  seed,
  categories,
  brands,
  lifeCategories,
  accounts,
  homeCurrency,
  onClose,
  onChanged,
}: FindSimilarPanelProps) {
  const [form, setForm] = useState<SimilarForm>(() =>
    seed.kind === 'transaction' ? formFromTransaction(seed.tx) : formFromSearch(seed.text),
  );
  const [result, setResult] = useState<MatchResult | null>(null);
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [counting, setCounting] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [rowsHome, setRowsHome] = useState(homeCurrency);
  const [searchVersion, setSearchVersion] = useState(0);

  const [edit, setEdit] = useState<EditForm>(EMPTY_EDIT);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [editResult, setEditResult] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [undoVersion, setUndoVersion] = useState(0);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const criteria = useMemo(() => criteriaFromForm(form), [form]);
  const criteriaKey = JSON.stringify(criteria);
  const nothingTicked = Object.keys(criteria).length === 0;

  // The live count: searches again a moment after the ticked details stop changing.
  useEffect(() => {
    const body = JSON.parse(criteriaKey) as Record<string, unknown>;
    if (Object.keys(body).length === 0) {
      setResult(null);
      setRows([]);
      setSelected(new Set());
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCounting(true);
      setSearchError(null);
      try {
        const res = await fetch('/api/finance/transactions/similar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ criteria: body, page: 0, page_size: PAGE_SIZE }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSearchError(typeof data.error === 'string' ? data.error : 'The search failed. Please try again.');
          setResult(null);
          setRows([]);
          setSelected(new Set());
          return;
        }
        const ids: string[] = Array.isArray(data.ids) ? data.ids : [];
        setResult({
          total: Number(data.total ?? 0),
          ids,
          transferCount: Number(data.transfer_count ?? 0),
          truncated: data.truncated === true,
          capped: data.capped === true,
        });
        setRows(Array.isArray(data.rows) ? data.rows : []);
        if (typeof data.home_currency === 'string') setRowsHome(data.home_currency);
        setPage(0);
        // Every match starts selected; untick the ones to leave out.
        setSelected(new Set(ids));
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') setSearchError("Couldn't search. Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setCounting(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [criteriaKey, searchVersion]);

  const goToPage = async (next: number) => {
    if (!result) return;
    const pageIds = result.ids.slice(next * PAGE_SIZE, (next + 1) * PAGE_SIZE);
    try {
      const res = await fetch('/api/finance/transactions/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_ids: pageIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSearchError(typeof data.error === 'string' ? data.error : 'Could not load that page.');
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setPage(next);
    } catch {
      setSearchError("Couldn't load that page. Check your connection.");
    }
  };

  const update = <K extends keyof SimilarForm>(key: K, value: Partial<SimilarForm[K]>) =>
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], ...value } }));

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedIds = useMemo(() => (result ? result.ids.filter((id) => selected.has(id)) : []), [result, selected]);
  const totalPages = result ? Math.ceil(result.ids.length / PAGE_SIZE) : 0;
  const { spec, problem } = specFromEdit(edit);
  const busy = progress !== null;

  const categoryName = (id: string | null | undefined) => categories.find((c) => c.id === id)?.name;
  const rememberVendor =
    edit.vendor.trim() ||
    (seed.kind === 'transaction' && vendorKey(seed.tx.vendor) ? (seed.tx.vendor ?? '').trim() : form.vendor.on ? form.vendor.value.trim() : '');

  const handleApply = async () => {
    if (!spec || selectedIds.length === 0) return;
    if (selectedIds.length > PAGE_SIZE && !confirm(`Change ${plural(selectedIds.length, 'transaction')}? You can undo this afterwards.`)) return;
    setEditError(null);
    setEditResult(null);
    setProgress({ sent: 0, total: selectedIds.length });
    const summary = describeEdit(spec, {
      category: categoryName(spec.category_id ?? undefined),
      brand: brands.find((b) => b.id === spec.brand_id)?.name,
      lifeAdd: lifeCategories.find((l) => l.id === spec.life_add)?.name,
      lifeRemove: lifeCategories.find((l) => l.id === spec.life_remove)?.name,
    });
    const outcome = await runBulkEdit(selectedIds, spec, summary, (sent, total) => setProgress({ sent, total }));
    setProgress(null);
    const t = outcome.totals;
    const parts = [`Saved changes to ${plural(t.done, 'selected transaction')}.`];
    if (t.done > 0 && t.changed === 0) parts.push('They already had these values.');
    if (t.unlinked > 0) parts.push(`Unlinked ${plural(t.unlinked, 'transfer side')} (both sides of each transfer).`);
    if (t.typeSkipped > 0) parts.push(`${plural(t.typeSkipped, 'transfer side')} kept ${t.typeSkipped === 1 ? 'its' : 'their'} type; unlink ${t.typeSkipped === 1 ? 'it' : 'them'} to change the type.`);
    if (t.notFound > 0) parts.push(`${plural(t.notFound, 'transaction')} ${t.notFound === 1 ? 'was' : 'were'} not found (deleted since?) and ${t.notFound === 1 ? 'was' : 'were'} skipped.`);
    if (t.remembered.length > 0) parts.push(`Saved ${plural(t.remembered.length, 'vendor rule')} for future imports.`);
    if (t.rememberFailed > 0) parts.push(`${plural(t.rememberFailed, 'vendor rule')} could not be saved.`);
    if (t.notice) parts.push(t.notice);
    else if (!t.undoRecorded) parts.push('This edit could not be recorded for undo.');
    if (outcome.ok) {
      setEditResult(parts.join(' '));
      setEdit(EMPTY_EDIT);
    } else {
      setEditError(
        t.done > 0
          ? `${outcome.error} Stopped after ${plural(t.done, 'transaction')}; those changes were saved and can be undone.`
          : `${outcome.error} Nothing was changed.`,
      );
    }
    if (t.done > 0) {
      setUndoVersion((v) => v + 1);
      setSearchVersion((v) => v + 1);
      onChanged();
    }
  };

  const activeAccounts = accounts.filter((a) => a.is_active !== false);

  return (
    <section
      aria-labelledby="find-similar-heading"
      className="bg-white border border-sky-200 rounded-xl p-4 space-y-4"
    >
      <div className="flex items-start gap-3">
        <ScanSearch className="w-5 h-5 mt-1 text-sky-600 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h2 id="find-similar-heading" ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-gray-900 outline-none">
            Find similar transactions
          </h2>
          <p className="text-sm text-gray-600">
            {seed.kind === 'transaction'
              ? `Like “${seed.tx.description || seed.tx.vendor || 'this transaction'}”. Tick the details the others must share.`
              : 'From your search. Tick the details the others must share.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Find similar"
          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* The details to match */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-800 mb-1">Must share</legend>

        <div className="grid grid-cols-1 sm:grid-cols-[13rem_1fr] gap-x-3 gap-y-1 items-center">
          <label className="flex items-center gap-2 min-h-11 cursor-pointer text-sm text-gray-800">
            <input type="checkbox" checked={form.vendor.on} onChange={(e) => update('vendor', { on: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-sky-600" />
            Same vendor
          </label>
          <div>
            <label htmlFor="similar-vendor" className="sr-only">Vendor name</label>
            <input
              id="similar-vendor"
              type="text"
              value={form.vendor.value}
              onChange={(e) => update('vendor', { on: true, value: e.target.value })}
              placeholder="Vendor name"
              className={inputClass}
            />
            {form.vendor.on && vendorKey(form.vendor.value) && (
              <p className="text-xs text-gray-600 mt-1">
                Any spelling that reads as &ldquo;{vendorKey(form.vendor.value)}&rdquo; once store numbers and punctuation are removed.
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 min-h-11 cursor-pointer text-sm text-gray-800">
            <input type="checkbox" checked={form.words.on} onChange={(e) => update('words', { on: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-sky-600" />
            Similar description
          </label>
          <div>
            <label htmlFor="similar-words" className="sr-only">Words the description or vendor must contain</label>
            <input
              id="similar-words"
              type="text"
              value={form.words.value}
              onChange={(e) => update('words', { on: true, value: e.target.value })}
              placeholder="Words, e.g. chipotle austin"
              className={inputClass}
            />
            {form.words.on && (
              <p className="text-xs text-gray-600 mt-1">Every word must appear in the description or the vendor, in any case.</p>
            )}
          </div>

          <label className="flex items-center gap-2 min-h-11 cursor-pointer text-sm text-gray-800">
            <input type="checkbox" checked={form.amount.on} onChange={(e) => update('amount', { on: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-sky-600" />
            Same amount
          </label>
          <div className="flex items-center gap-2">
            <label htmlFor="similar-amount" className="sr-only">Amount</label>
            <input
              id="similar-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.amount.value}
              onChange={(e) => update('amount', { on: true, value: e.target.value })}
              className={inputClass}
            />
            <span className="text-sm text-gray-700" aria-hidden="true">±</span>
            <label htmlFor="similar-tolerance" className="sr-only">Give or take</label>
            <input
              id="similar-tolerance"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.amount.tolerance}
              onChange={(e) => update('amount', { on: true, tolerance: e.target.value })}
              className={`${inputClass} max-w-28`}
            />
          </div>

          <label className="flex items-center gap-2 min-h-11 cursor-pointer text-sm text-gray-800">
            <input type="checkbox" checked={form.account.on} onChange={(e) => update('account', { on: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-sky-600" />
            Same account
          </label>
          <div>
            <label htmlFor="similar-account" className="sr-only">Account</label>
            <select id="similar-account" value={form.account.value} onChange={(e) => update('account', { on: true, value: e.target.value })} className={inputClass}>
              <option value={NONE}>No account</option>
              {activeAccounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 min-h-11 cursor-pointer text-sm text-gray-800">
            <input type="checkbox" checked={form.category.on} onChange={(e) => update('category', { on: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-sky-600" />
            Same category
          </label>
          <div>
            <label htmlFor="similar-category" className="sr-only">Category</label>
            <select id="similar-category" value={form.category.value} onChange={(e) => update('category', { on: true, value: e.target.value })} className={inputClass}>
              <option value={NONE}>Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 min-h-11 cursor-pointer text-sm text-gray-800">
            <input type="checkbox" checked={form.type.on} onChange={(e) => update('type', { on: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-sky-600" />
            Same type
          </label>
          <div>
            <label htmlFor="similar-type" className="sr-only">Type</label>
            <select id="similar-type" value={form.type.value} onChange={(e) => update('type', { on: true, value: e.target.value === 'income' ? 'income' : 'expense' })} className={inputClass}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>

          <label className="flex items-center gap-2 min-h-11 cursor-pointer text-sm text-gray-800">
            <input type="checkbox" checked={form.dates.on} onChange={(e) => update('dates', { on: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-sky-600" />
            Date range
          </label>
          <div className="flex items-center gap-2">
            <label htmlFor="similar-from" className="sr-only">From</label>
            <input id="similar-from" type="date" value={form.dates.from} onChange={(e) => update('dates', { on: true, from: e.target.value })} className={inputClass} />
            <span className="text-sm text-gray-700" aria-hidden="true">–</span>
            <label htmlFor="similar-to" className="sr-only">To</label>
            <input id="similar-to" type="date" value={form.dates.to} onChange={(e) => update('dates', { on: true, to: e.target.value })} className={inputClass} />
          </div>
        </div>
      </fieldset>

      {/* The live count */}
      <div role="status" aria-live="polite" className="text-sm text-gray-800 min-h-6">
        {nothingTicked ? (
          'Tick at least one detail to find matches.'
        ) : counting ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Counting…</span>
        ) : result ? (
          <span>
            <strong>{plural(result.total, 'transaction')}</strong> {result.total === 1 ? 'matches' : 'match'}
            {result.total > 0 && <> · {selectedIds.length.toLocaleString()} selected</>}
            {result.transferCount > 0 && <> · {plural(result.transferCount, 'transfer side')}</>}
          </span>
        ) : null}
      </div>
      {result?.truncated && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
          There are more than 30,000 transactions to look through, so only the newest 30,000 were checked. Tick a date range or another detail to narrow it.
        </p>
      )}
      {result?.capped && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Only the newest {result.ids.length.toLocaleString()} matches can be selected at once. Narrow the details to reach the rest.
        </p>
      )}
      {searchError && (
        <p role="alert" className="p-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{searchError}</p>
      )}

      {/* The matches */}
      {result && result.total > 0 && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => setSelected(new Set(result.ids))} className="min-h-11 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
              Select all {result.ids.length.toLocaleString()}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="min-h-11 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
              Select none
            </button>
          </div>
          <ul role="list" aria-label="Matching transactions" className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2 px-2">
                <label className="flex items-center gap-3 flex-1 min-w-0 min-h-11 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    className="w-4 h-4 rounded border-gray-300 text-sky-600 shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-900 truncate">{row.description || row.vendor || 'Transaction'}</span>
                    <span className="block text-xs text-gray-600 truncate">
                      {new Date(`${row.transaction_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {row.vendor && row.description ? ` · ${row.vendor}` : ''}
                      {row.financial_accounts ? ` · ${accountLabel(row.financial_accounts)}` : ''}
                      {` · ${row.budget_categories?.name ?? 'Uncategorized'}`}
                    </span>
                    {row.transfer_group_id && (
                      <span className="inline-flex items-center gap-1 text-xs text-indigo-700 mt-0.5">
                        <ArrowRightLeft className="w-3 h-3" aria-hidden="true" /> Transfer side
                      </span>
                    )}
                  </span>
                  <TxAmount tx={row} homeCurrency={rowsHome} className="text-sm font-medium shrink-0" />
                </label>
                <Link
                  href={`/dashboard/finance/transactions/${row.id}`}
                  aria-label={`Open ${row.description || row.vendor || 'transaction'}`}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-600">Page {page + 1} of {totalPages}</p>
              <div className="flex gap-1">
                <button type="button" onClick={() => goToPage(page - 1)} disabled={page === 0} className="min-h-11 px-3 flex items-center gap-1 text-sm text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Prev
                </button>
                <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1} className="min-h-11 px-3 flex items-center gap-1 text-sm text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  Next <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* The edit */}
      {result && result.total > 0 && (
        <fieldset className="border-t border-gray-100 pt-4 space-y-3" disabled={busy}>
          <legend className="text-sm font-medium text-gray-800">
            Change the {plural(selectedIds.length, 'selected transaction')}
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="bulk-category" className={labelClass}>Category</label>
              <select id="bulk-category" value={edit.category} onChange={(e) => setEdit((p) => ({ ...p, category: e.target.value }))} className={inputClass}>
                <option value={KEEP}>Leave as is</option>
                <option value={NONE}>No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bulk-vendor" className={labelClass}>Rename vendor to</label>
              <input id="bulk-vendor" type="text" value={edit.vendor} maxLength={200} onChange={(e) => setEdit((p) => ({ ...p, vendor: e.target.value }))} placeholder="Leave blank to keep" className={inputClass} />
            </div>
            <div>
              <label htmlFor="bulk-type" className={labelClass}>Type</label>
              <select id="bulk-type" value={edit.type} onChange={(e) => setEdit((p) => ({ ...p, type: e.target.value === 'income' ? 'income' : e.target.value === 'expense' ? 'expense' : '' }))} className={inputClass}>
                <option value="">Leave as is</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              {edit.type && result.transferCount > 0 && !edit.unlink && (
                <p className="text-xs text-gray-600 mt-1">Transfer sides keep their type unless you also unlink them.</p>
              )}
            </div>
            {brands.length > 0 && (
              <div>
                <label htmlFor="bulk-brand" className={labelClass}>Brand</label>
                <select id="bulk-brand" value={edit.brand} onChange={(e) => setEdit((p) => ({ ...p, brand: e.target.value }))} className={inputClass}>
                  <option value={KEEP}>Leave as is</option>
                  <option value={NONE}>No brand</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            {lifeCategories.length > 0 && (
              <>
                <div>
                  <label htmlFor="bulk-life-add" className={labelClass}>Add life category</label>
                  <select id="bulk-life-add" value={edit.lifeAdd} onChange={(e) => setEdit((p) => ({ ...p, lifeAdd: e.target.value }))} className={inputClass}>
                    <option value={KEEP}>None</option>
                    {lifeCategories.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="bulk-life-remove" className={labelClass}>Remove life category</label>
                  <select id="bulk-life-remove" value={edit.lifeRemove} onChange={(e) => setEdit((p) => ({ ...p, lifeRemove: e.target.value }))} className={inputClass}>
                    <option value={KEEP}>None</option>
                    {lifeCategories.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label htmlFor="bulk-tags-add" className={labelClass}>Add tags</label>
              <input id="bulk-tags-add" type="text" value={edit.tagsAdd} onChange={(e) => setEdit((p) => ({ ...p, tagsAdd: e.target.value }))} placeholder="lunch, work" className={inputClass} />
            </div>
            <div>
              <label htmlFor="bulk-tags-remove" className={labelClass}>Remove tags</label>
              <input id="bulk-tags-remove" type="text" value={edit.tagsRemove} onChange={(e) => setEdit((p) => ({ ...p, tagsRemove: e.target.value }))} placeholder="old-tag" className={inputClass} />
            </div>
          </div>

          {result.transferCount > 0 && (
            <label className="flex items-start gap-2 min-h-11 cursor-pointer text-sm text-gray-800">
              <input type="checkbox" checked={edit.unlink} onChange={(e) => setEdit((p) => ({ ...p, unlink: e.target.checked }))} className="mt-1 w-4 h-4 rounded border-gray-300 text-sky-600" />
              <span>
                Unlink the selected transfers
                <span className="block text-xs text-gray-600">Both sides of each transfer are unlinked together, even when only one side is selected. They count as spending and income again.</span>
              </span>
            </label>
          )}

          <label className={`flex items-start gap-2 min-h-11 text-sm ${spec?.category_id ? 'text-gray-800 cursor-pointer' : 'text-gray-500'}`}>
            <input
              type="checkbox"
              checked={edit.remember && Boolean(spec?.category_id)}
              disabled={!spec?.category_id}
              onChange={(e) => setEdit((p) => ({ ...p, remember: e.target.checked }))}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-sky-600"
            />
            <span>
              Remember for future imports
              <span className="block text-xs text-gray-600">
                {spec?.category_id
                  ? `Saves ${rememberVendor ? `‘${rememberVendor}’` : 'each selected vendor'} → ${categoryName(spec.category_id) ?? 'this category'} as a learned rule, so new and imported transactions from the selected vendors get it automatically.`
                  : 'Choose a category to save it as a learned rule for the selected vendors.'}
              </span>
            </span>
          </label>

          {problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              disabled={!spec || selectedIds.length === 0 || busy}
              className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
              Apply to {plural(selectedIds.length, 'transaction')}
            </button>
            {progress && (
              <div role="status" className="flex-1 flex items-center gap-2 text-sm text-gray-700">
                <progress value={progress.sent} max={progress.total} aria-label="Saving the bulk edit" className="w-full sm:w-48 h-2" />
                <span>Saved {progress.sent.toLocaleString()} of {progress.total.toLocaleString()}</span>
              </div>
            )}
          </div>
        </fieldset>
      )}

      {editResult && <p role="status" className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sm text-sky-900">{editResult}</p>}
      {editError && <p role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{editError}</p>}

      <BulkEditUndo
        refreshKey={undoVersion}
        onUndone={() => {
          setSearchVersion((v) => v + 1);
          onChanged();
        }}
      />
    </section>
  );
}
