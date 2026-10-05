'use client';

// components/settings/CalendarDefaultAccount.tsx
// Settings → Google Calendar, per connected account: which finance account the transactions
// from #expense / #income events go to. The amount in the title is read in that account's
// currency. Saved with PATCH /api/calendar/google { connection_id, default_account_id }.

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export interface CalendarFinanceAccount {
  id: string;
  name: string;
  institution_name?: string | null;
  last_four?: string | null;
  currency?: string | null;
  is_active?: boolean | null;
}

interface Props {
  connectionId: string;
  /** The saved default, or null. */
  value: string | null;
  /** The user's finance accounts; null while loading. */
  accounts: CalendarFinanceAccount[] | null;
  accountLabel: string;
  onSaved: (accountId: string | null) => void;
}

function label(a: CalendarFinanceAccount): string {
  const parts = [a.name];
  if (a.institution_name) parts.push(a.institution_name);
  if (a.last_four) parts.push(`…${a.last_four}`);
  return `${parts.join(' · ')}${a.currency ? ` (${a.currency})` : ''}`;
}

export default function CalendarDefaultAccount({ connectionId, value, accounts, accountLabel, onSaved }: Props) {
  const selectId = useId();
  const [selected, setSelected] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => setSelected(value ?? ''), [value]);

  const save = async (next: string) => {
    const previous = selected;
    setSelected(next);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/calendar/google', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId, default_account_id: next || null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setSelected(previous);
        setError(body?.error ?? 'That change could not be saved.');
        return;
      }
      setSaved(true);
      onSaved(next || null);
    } catch {
      setSelected(previous);
      setError('Could not reach the server, so that change was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const options = (accounts ?? []).filter((a) => a.is_active !== false || a.id === value);
  const missing = Boolean(value) && accounts !== null && !options.some((a) => a.id === value);

  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="block font-medium text-gray-900">
        Account for #expense and #income
      </label>
      <p className="text-sm text-gray-600">
        Tagged money events from {accountLabel} become transactions in this account, and the amount is read in its
        currency. With no account chosen they are saved without one.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <select
          id={selectId}
          value={missing ? '' : selected}
          disabled={saving || accounts === null}
          onChange={(e) => save(e.target.value)}
          className="min-h-11 w-full sm:w-auto sm:min-w-72 px-3 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 disabled:opacity-60"
        >
          <option value="">{accounts === null ? 'Loading accounts…' : 'No account'}</option>
          {options.map((a) => (
            <option key={a.id} value={a.id}>
              {label(a)}
            </option>
          ))}
        </select>
        {saving && (
          <span role="status" className="inline-flex items-center gap-1 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Saving
          </span>
        )}
        {saved && !saving && (
          <span role="status" className="text-sm text-green-800">
            Saved
          </span>
        )}
      </div>
      {missing && (
        <p className="text-sm text-amber-900">
          The account chosen before is no longer available; transactions are saved without an account until you
          choose another.
        </p>
      )}
      {accounts !== null && accounts.length === 0 && (
        <p className="text-sm text-gray-600">
          You have no finance accounts yet.{' '}
          <Link href="/dashboard/finance/accounts" className="text-sky-800 underline">
            Add one
          </Link>
          .
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
