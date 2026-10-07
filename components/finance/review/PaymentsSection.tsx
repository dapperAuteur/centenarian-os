'use client';

// components/finance/review/PaymentsSection.tsx
// Review page: card and loan payments whose other side isn't linked.
//   - A payment on a card or loan with no "Paid from" account.
//   - Money out of a bank account, worded like a card or loan payment, with
//     no matching row on a card or loan ("Paid to").
// Choose the account (it starts on the one usually used) and Link: the
// matching row there is linked, or, when there is none and "Record the payment
// on the other account" is ticked, the other side is recorded there, as the
// statement import does. "Not a payment" is remembered.

import { forwardRef, useMemo, useState } from 'react';
import { Link2, X } from 'lucide-react';
import { TRANSFER_KIND_LABEL } from '@/lib/finance/transfers/pairing';
import type { PaymentItem } from '@/lib/finance/review/sections';
import type { SectionPage } from '@/lib/finance/review/server';
import { StatusChip, fieldLabel, primaryButton, secondaryButton, selectInput } from '@/components/finance/import/shared';
import { dismiss, failureText, linkPayments, plural } from './api';
import SectionShell, { ItemCheckbox } from './SectionShell';
import TxnLine, { money } from './TxnLine';
import type { PickerAccount, RunAction } from './types';

interface PaymentsSectionProps {
  page: SectionPage<PaymentItem>;
  pageSize: number;
  onPage: (offset: number) => void;
  busy: boolean;
  onAction: RunAction;
  accounts: PickerAccount[];
  canRemember: boolean;
}

const isDebt = (type: string) => type === 'credit_card' || type === 'loan';

/** The picker's two groups: the kind of account this payment usually involves first, then the rest. */
function pickerGroups(item: PaymentItem, accounts: readonly PickerAccount[]) {
  const others = accounts.filter((account) => account.id !== item.transaction.account_id);
  const preferred = others.filter((account) => (item.side === 'paid_from' ? !isDebt(account.account_type) : isDebt(account.account_type)));
  const rest = others.filter((account) => !preferred.includes(account));
  return item.side === 'paid_from'
    ? [{ label: 'Bank and cash accounts', accounts: preferred }, { label: 'Cards and loans', accounts: rest }]
    : [{ label: 'Cards and loans', accounts: preferred }, { label: 'Bank and cash accounts', accounts: rest }];
}

function AccountOptions({ groups }: { groups: { label: string; accounts: PickerAccount[] }[] }) {
  return (
    <>
      {groups
        .filter((group) => group.accounts.length > 0)
        .map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
                {account.is_active ? '' : ' (inactive)'}
              </option>
            ))}
          </optgroup>
        ))}
    </>
  );
}

const PaymentsSection = forwardRef<HTMLHeadingElement, PaymentsSectionProps>(function PaymentsSection(
  { page, pageSize, onPage, busy, onAction, accounts, canRemember },
  headingRef,
) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [recordMissing, setRecordMissing] = useState(true);
  const [bulkAccount, setBulkAccount] = useState('');
  const pageKeys = useMemo(() => page.items.map((item) => item.key), [page.items]);

  const accountFor = (item: PaymentItem): string => choices[item.transaction.id] ?? item.suggested_account_id ?? '';
  const chosen = page.items.filter((item) => selected.has(item.key));

  const link = (items: PaymentItem[]) =>
    onAction('payments', async () => {
      const missing = items.filter((item) => !accountFor(item));
      if (missing.length > 0) {
        return {
          error: `Choose the account for ${plural(missing.length, 'payment', 'payments')} first (${missing
            .slice(0, 3)
            .map((item) => `${money(item.transaction.amount)} on ${item.transaction.date}`)
            .join(', ')}).`,
        };
      }
      const response = await linkPayments(
        items.map((item) => ({ transaction_id: item.transaction.id, account_id: accountFor(item) })),
        recordMissing,
      );
      if (!response.ok) return { error: response.message };
      const { linked, recorded, unmatched, failed } = response.data;
      const parts: string[] = [];
      if (linked > 0) parts.push(`${plural(linked, 'payment was', 'payments were')} linked to the matching transaction`);
      if (recorded > 0) parts.push(`${plural(recorded, 'payment was', 'payments were')} recorded on the other account`);
      if (unmatched > 0) parts.push(`${plural(unmatched, 'payment has', 'payments have')} no matching transaction and was left as it is`);
      return {
        status: parts.length > 0 ? `${parts.join('; ')}. Linked payments no longer count as spending or income.` : undefined,
        error: failed.length > 0 ? failureText(failed) : undefined,
      };
    });

  const notPayment = (items: PaymentItem[]) =>
    onAction('payments', async () => {
      const response = await dismiss(items.map((item) => ({ section: 'one_sided_payment' as const, transaction_id: item.transaction.id })));
      if (!response.ok) return { error: response.message };
      return { status: `${plural(items.length, 'item', 'items')} marked as not a payment. ${items.length === 1 ? 'It' : 'They'} won't be listed again.` };
    });

  const applyBulkAccount = (accountId: string) => {
    setBulkAccount(accountId);
    if (!accountId) return;
    setChoices((current) => {
      const next = { ...current };
      for (const item of chosen) if (item.transaction.account_id !== accountId) next[item.transaction.id] = accountId;
      return next;
    });
  };

  return (
    <SectionShell
      ref={headingRef}
      id="review-payments"
      title="Card and loan payments with no other side"
      description={
        <p>
          A payment to a card or loan moves your own money, so it is linked to the account on the other side instead
          of counting as income or spending. These have no link yet: a payment on a card or loan with no &ldquo;Paid
          from&rdquo;, or money out of a bank account worded like a card or loan payment with no &ldquo;Paid to&rdquo;.
        </p>
      }
      total={page.total}
      offset={page.offset}
      pageSize={pageSize}
      onPage={onPage}
      pageKeys={pageKeys}
      selected={selected}
      onSelectAll={(all) => setSelected(all ? new Set(pageKeys) : new Set())}
      busy={busy}
      bulk={
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0">
            <label htmlFor="payments-bulk-account" className={fieldLabel}>
              Account for the selected
            </label>
            <select
              id="payments-bulk-account"
              value={bulkAccount}
              onChange={(event) => applyBulkAccount(event.target.value)}
              disabled={busy || chosen.length === 0}
              className={selectInput}
            >
              <option value="">Choose an account...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                  {account.is_active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => link(chosen)} disabled={busy || chosen.length === 0} className={primaryButton}>
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Link selected{chosen.length > 0 ? ` (${chosen.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => notPayment(chosen)}
            disabled={busy || chosen.length === 0 || !canRemember}
            className={secondaryButton}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Not a payment{chosen.length > 0 ? ` (${chosen.length})` : ''}
          </button>
          <label className="flex min-h-11 items-center gap-2 text-sm text-gray-800 sm:basis-full">
            <input
              type="checkbox"
              checked={recordMissing}
              onChange={(event) => setRecordMissing(event.target.checked)}
              disabled={busy}
              className="h-5 w-5 rounded border-gray-400 text-sky-700"
            />
            Record the payment on the other account if it isn&rsquo;t there yet
          </label>
        </div>
      }
    >
      {page.items.map((item) => {
        const selectId = `payment-account-${item.transaction.id}`;
        const what = `${money(item.transaction.amount)} on ${item.transaction.account_label}, ${item.transaction.date}`;
        const value = accountFor(item);
        return (
          <li key={item.key} className="flex gap-2 py-3">
            <ItemCheckbox
              checked={selected.has(item.key)}
              onChange={(on) =>
                setSelected((current) => {
                  const next = new Set(current);
                  if (on) next.add(item.key);
                  else next.delete(item.key);
                  return next;
                })
              }
              label={`Select the payment of ${what}`}
              disabled={busy}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone="neutral">{TRANSFER_KIND_LABEL[item.kind]}</StatusChip>
                <StatusChip tone="attention">{item.side === 'paid_from' ? 'No "Paid from"' : 'No "Paid to"'}</StatusChip>
              </div>
              <TxnLine row={item.transaction} />
              <p className="text-xs text-gray-700">{item.reasons.join('. ')}.</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor={selectId} className={fieldLabel}>
                    {item.side === 'paid_from' ? 'Paid from' : 'Paid to'}
                  </label>
                  <select
                    id={selectId}
                    value={value}
                    onChange={(event) => setChoices((current) => ({ ...current, [item.transaction.id]: event.target.value }))}
                    disabled={busy}
                    className={selectInput}
                  >
                    <option value="">Choose an account...</option>
                    <AccountOptions groups={pickerGroups(item, accounts)} />
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => link([item])}
                  disabled={busy || !value}
                  aria-label={`Link the payment of ${what}`}
                  className={primaryButton}
                >
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => notPayment([item])}
                  disabled={busy || !canRemember}
                  aria-label={`Not a payment: ${what}`}
                  className={secondaryButton}
                >
                  Not a payment
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </SectionShell>
  );
});

export default PaymentsSection;
