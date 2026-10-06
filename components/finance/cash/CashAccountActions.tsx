'use client';

// components/finance/cash/CashAccountActions.tsx
// Count and Paid cash buttons for one cash account on the Accounts page. Loads
// the cash overview (balance, last count) and the categories only when a
// button is pressed, then opens the count dialog or the Paid cash form.

import { useState } from 'react';
import { Banknote, Calculator } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { BudgetCategory } from '@/components/finance/CategorySelect';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import type { CashOverviewResponse } from '@/lib/finance/cash/client';
import CountCashModal from './CountCashModal';
import PaidCashForm from './PaidCashForm';

interface CashAccountActionsProps {
  accountId: string;
  accountName: string;
  /** Called after a count or a payment, to refresh balances. */
  onChanged: () => void;
}

const button =
  'inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900';

export default function CashAccountActions({ accountId, accountName, onChanged }: CashAccountActionsProps) {
  const [open, setOpen] = useState<'count' | 'paid' | null>(null);
  const [data, setData] = useState<CashOverviewResponse | null>(null);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [paidAccountId, setPaidAccountId] = useState(accountId);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<boolean> {
    setError(null);
    try {
      const [cashRes, catRes] = await Promise.all([
        offlineFetch(`/api/finance/cash?today=${todayLocal()}`),
        offlineFetch('/api/finance/categories'),
      ]);
      const cash = await cashRes.json().catch(() => null);
      if (!cashRes.ok || !Array.isArray(cash?.accounts)) {
        setError(typeof cash?.error === 'string' ? cash.error : 'Could not load your cash accounts.');
        return false;
      }
      setData(cash as CashOverviewResponse);
      if (catRes.ok) {
        const body = await catRes.json().catch(() => null);
        setCategories(Array.isArray(body?.categories) ? body.categories : []);
      }
      return true;
    } catch {
      setError('Could not load your cash accounts. Check your connection.');
      return false;
    }
  }

  async function show(which: 'count' | 'paid') {
    setPaidAccountId(accountId);
    if (await load()) setOpen(which);
  }

  function changed() {
    void load();
    onChanged();
  }

  const account = data?.accounts.find((a) => a.id === accountId) ?? null;

  return (
    <>
      <button type="button" onClick={() => show('count')} className={button}>
        <Calculator className="h-4 w-4" aria-hidden="true" />
        Count
        <span className="sr-only"> the cash in {accountName}</span>
      </button>
      <button type="button" onClick={() => show('paid')} className={button}>
        <Banknote className="h-4 w-4" aria-hidden="true" />
        Paid cash
        <span className="sr-only"> from {accountName}</span>
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-800">
          {error}
        </span>
      )}

      <CountCashModal
        isOpen={open === 'count'}
        onClose={() => setOpen(null)}
        account={open === 'count' ? account : null}
        ready={data?.ready ?? false}
        categories={categories}
        onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
        onChanged={changed}
      />

      <Modal isOpen={open === 'paid'} onClose={() => setOpen(null)} title="Paid cash" size="sm">
        <div className="p-6">
          {data && (
            <PaidCashForm
              accounts={data.accounts}
              accountId={paidAccountId}
              onAccountChange={setPaidAccountId}
              categories={categories}
              onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
              onSaved={changed}
              idPrefix={`acct-paid-cash-${accountId}`}
            />
          )}
        </div>
      </Modal>
    </>
  );
}
