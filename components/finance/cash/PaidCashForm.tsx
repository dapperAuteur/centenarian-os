'use client';

// components/finance/cash/PaidCashForm.tsx
// "Paid cash": the quickest way to record spending from a cash account.
// Amount, what it was for, an optional category (the vendor's learned
// category is suggested), the date (today) and the cash account (the last one
// used, in its own currency). One tap saves it as an expense on that account
// through the offline queue, so it works with no connection.
//
// The cash account is controlled by the parent, so a "Paid cash" button on an
// account can pick it and focus the amount (amountRef).

import { useState, type RefObject } from 'react';
import { Banknote, Loader2, Sparkles } from 'lucide-react';
import CategorySelect, { type BudgetCategory } from '@/components/finance/CategorySelect';
import { offlineFetch, isQueuedResponse } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import { formatMoney } from '@/lib/finance/fx/math';
import { accountLabel } from '@/lib/finance/transfers/pairing';
import { rememberCashAccount, type CashAccountView } from '@/lib/finance/cash/client';

interface PaidCashFormProps {
  /** Active cash accounts. */
  accounts: CashAccountView[];
  accountId: string;
  onAccountChange: (accountId: string) => void;
  categories: BudgetCategory[];
  onCategoryCreated: (category: BudgetCategory) => void;
  /** Called after a save (or a queued save), to refresh balances. */
  onSaved: () => void;
  /** Lets a "Paid cash" button focus the amount. */
  amountRef?: RefObject<HTMLInputElement | null>;
  /** Prefix for element ids, so two forms can share a page. */
  idPrefix?: string;
}

const input = 'w-full min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
const label = 'mb-1 block text-xs font-medium text-gray-700';

export default function PaidCashForm({
  accounts,
  accountId,
  onAccountChange,
  categories,
  onCategoryCreated,
  onSaved,
  amountRef,
  idPrefix = 'paid-cash',
}: PaidCashFormProps) {
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [learnedFor, setLearnedFor] = useState<string | null>(null);
  const [date, setDate] = useState(todayLocal());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const currency = account?.currency ?? 'USD';
  const id = (name: string) => `${idPrefix}-${name}`;

  /** Suggests the vendor's learned category, unless a category was already picked. */
  async function suggestCategory() {
    const vendor = what.trim();
    if (!vendor || categoryTouched || !navigator.onLine) return;
    try {
      const res = await fetch(`/api/finance/learned-categories?vendor=${encodeURIComponent(vendor)}&type=expense`);
      if (!res.ok) return;
      const body = (await res.json()) as { learned_category_id?: string | null };
      if (body.learned_category_id && categories.some((c) => c.id === body.learned_category_id)) {
        setCategoryId(body.learned_category_id);
        setLearnedFor(vendor);
      } else {
        setCategoryId('');
        setLearnedFor(null);
      }
    } catch {
      /* no suggestion offline; the server still applies a learned category at save */
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    const value = Number(amount.replace(/,/g, ''));
    if (!account) {
      setError('Add a cash account first.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter how much you paid, like 12.50.');
      return;
    }
    if (!what.trim()) {
      setError('Say what it was for, like "Farmers market".');
      return;
    }
    setSaving(true);
    try {
      const res = await offlineFetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: value,
          type: 'expense',
          vendor: what.trim(),
          description: what.trim(),
          transaction_date: date,
          category_id: categoryId || null,
          account_id: account.id,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === 'string' ? `Couldn't save: ${body.error}` : `Couldn't save (error ${res.status}). Try again.`);
        return;
      }
      rememberCashAccount(account.id);
      setStatus(
        isQueuedResponse(res)
          ? `You're offline. ${formatMoney(value, currency)} from ${account.name} is queued and will be saved when you reconnect.`
          : `Saved: ${formatMoney(value, currency)} paid in cash from ${account.name}.`,
      );
      setAmount('');
      setWhat('');
      setCategoryId('');
      setCategoryTouched(false);
      setLearnedFor(null);
      onSaved();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" aria-labelledby={id('heading')}>
      <h3 id={id('heading')} className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <Banknote className="h-4 w-4 text-sky-700" aria-hidden="true" />
        Paid cash
      </h3>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id('amount')} className={label}>
            Amount ({currency})
          </label>
          <input
            id={id('amount')}
            ref={amountRef}
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={input}
            placeholder="0.00"
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor={id('date')} className={label}>
            Date
          </label>
          <input id={id('date')} type="date" value={date} onChange={(e) => setDate(e.target.value || todayLocal())} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor={id('what')} className={label}>
          What was it for?
        </label>
        <input
          id={id('what')}
          value={what}
          onChange={(e) => {
            setWhat(e.target.value);
            if (learnedFor && e.target.value.trim() !== learnedFor) {
              setLearnedFor(null);
              if (!categoryTouched) setCategoryId('');
            }
          }}
          onBlur={suggestCategory}
          className={input}
          placeholder="Vendor or description"
          required
          aria-required="true"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <CategorySelect
            id={id('category')}
            size="touch"
            label="Category (optional)"
            value={categoryId}
            onChange={(value) => {
              setCategoryId(value);
              setCategoryTouched(true);
              setLearnedFor(null);
            }}
            categories={categories}
            onCategoryCreated={onCategoryCreated}
          />
          {learnedFor && categoryId && (
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-700">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden="true" />
              Learned from this vendor
            </p>
          )}
        </div>
        {accounts.length > 1 ? (
          <div>
            <label htmlFor={id('account')} className={label}>
              From cash account
            </label>
            <select id={id('account')} value={account?.id ?? ''} onChange={(e) => onAccountChange(e.target.value)} className={input}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)} ({a.currency})
                </option>
              ))}
            </select>
          </div>
        ) : (
          account && (
            <p className="self-end text-xs text-gray-700">
              From {accountLabel(account)} ({account.currency})
            </p>
          )
        )}
      </div>
      <button
        type="submit"
        disabled={saving || !account}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saving ? 'Saving...' : 'Save cash payment'}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-gray-800">
        {status}
      </p>
    </form>
  );
}
