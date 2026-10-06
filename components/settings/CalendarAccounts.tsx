'use client';

// components/settings/CalendarAccounts.tsx
// Settings → Google Calendar, per connected account: which finance accounts #expense / #income
// events may record into (checkboxes) and which of them is the default (used when a title names
// no account). Each ticked account shows the "@" token that names it in a title: its nickname
// (financial_accounts.nickname, migration 218, edited on Finance → Accounts), else its last four
// digits.
// Saved with PATCH /api/calendar/google { connection_id, allowed_account_ids, default_account_id };
// the rules live in lib/capture/calendar-accounts.ts. A connection saved
// with only the old single default reads as that one account ticked and default.

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { accountRefFor, readAccountChoice, type CalendarAccountChoice } from '@/lib/capture/calendar-accounts';
import { nicknameSuffix } from '@/lib/finance/account-nickname';

export interface CalendarFinanceAccount {
  id: string;
  name: string;
  account_type?: string | null;
  institution_name?: string | null;
  last_four?: string | null;
  /** Migration 218; missing before it. */
  nickname?: string | null;
  currency?: string | null;
  is_active?: boolean | null;
}

interface Props {
  connectionId: string;
  /** The connection's saved settings (old or new shape). */
  settings: Record<string, unknown> | null;
  /** The user's finance accounts; null while loading. */
  accounts: CalendarFinanceAccount[] | null;
  accountLabel: string;
  onSaved: () => unknown;
}

const TYPE_LABEL: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit cards',
  loan: 'Loans',
  cash: 'Cash',
};
const TYPE_ORDER = ['checking', 'savings', 'credit_card', 'cash', 'loan'];

function label(a: CalendarFinanceAccount): string {
  const parts = [a.name];
  if (a.institution_name) parts.push(a.institution_name);
  if (a.last_four) parts.push(`…${a.last_four}`);
  return `${parts.join(' · ')}${nicknameSuffix(a.nickname)}${a.currency ? ` (${a.currency})` : ''}`;
}

interface Patch {
  allowed_account_ids?: string[];
  default_account_id?: string | null;
}

export default function CalendarAccounts({ connectionId, settings, accounts, accountLabel, onSaved }: Props) {
  const baseId = useId();
  const saved = useMemo(() => readAccountChoice(settings), [settings]);
  const [choice, setChoice] = useState<CalendarAccountChoice>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    setChoice(saved);
  }, [saved]);

  const save = async (patch: Patch, next: CalendarAccountChoice) => {
    const previous = choice;
    setChoice(next);
    setSaving(true);
    setError(null);
    setSavedNote(false);
    try {
      const res = await fetch('/api/calendar/google', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId, ...patch }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setChoice(previous);
        setError(body?.error ?? 'That change could not be saved.');
        return;
      }
      setSavedNote(true);
      await onSaved();
    } catch {
      setChoice(previous);
      setError('Could not reach the server, so that change was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string, checked: boolean) => {
    const allowed = checked ? [...choice.allowedIds, id] : choice.allowedIds.filter((a) => a !== id);
    // The first account ticked becomes the default; unticking the default leaves none (you pick).
    let defaultId = choice.defaultId;
    if (checked && choice.allowedIds.length === 0) defaultId = id;
    if (!checked && defaultId === id) defaultId = null;
    save({ allowed_account_ids: allowed, default_account_id: defaultId }, { ...choice, allowedIds: allowed, defaultId });
  };

  const makeDefault = (id: string | null) => {
    save({ default_account_id: id }, { ...choice, defaultId: id });
  };

  const list = (accounts ?? []).filter((a) => a.is_active !== false || choice.allowedIds.includes(a.id.toLowerCase()));
  const groups = new Map<string, CalendarFinanceAccount[]>();
  for (const a of list) {
    const type = a.account_type ?? 'other';
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(a);
  }
  const orderedTypes = [...groups.keys()].sort(
    (x, y) => (TYPE_ORDER.indexOf(x) + 1 || 99) - (TYPE_ORDER.indexOf(y) + 1 || 99) || x.localeCompare(y),
  );
  const owned = (accounts ?? []).map((a) => ({ id: a.id, last_four: a.last_four, nickname: a.nickname }));
  const missing =
    accounts !== null && choice.allowedIds.filter((id) => !(accounts ?? []).some((a) => a.id.toLowerCase() === id));
  const tickedCount = choice.allowedIds.length;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium text-gray-900">Accounts for #expense and #income</h3>
        <p className="text-sm text-gray-600 mt-0.5">
          Tick the accounts tagged money events from {accountLabel} may record into, and pick a default. A title uses
          the default unless it names a ticked account with @ and its last four digits or its nickname (set on{' '}
          <Link href="/dashboard/finance/accounts" className="text-sky-800 underline">
            Finance → Accounts
          </Link>
          ), for example{' '}
          <code className="text-gray-900">Lunch Chipotle #expense $12.40 @1234</code>. The amount is read in that
          account&apos;s currency.
        </p>
      </div>

      {accounts === null && (
        <p role="status" className="inline-flex items-center gap-1 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Loading accounts…
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

      {orderedTypes.map((type) => (
        <fieldset key={type} className="border border-gray-200 rounded-lg p-3" disabled={saving}>
          <legend className="px-1 text-sm font-semibold text-gray-800">{TYPE_LABEL[type] ?? 'Other'}</legend>
          <ul role="list" className="divide-y divide-gray-100">
            {groups.get(type)!.map((a) => {
              const id = a.id.toLowerCase();
              const checked = choice.allowedIds.includes(id);
              const boxId = `${baseId}-acct-${id}`;
              const ref = checked ? accountRefFor(id, choice, owned) : null;
              return (
                <li key={id} className="py-2 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label htmlFor={boxId} className="min-h-11 flex items-center gap-2 flex-1 text-sm text-gray-900">
                      <input
                        id={boxId}
                        type="checkbox"
                        className="w-5 h-5 shrink-0"
                        checked={checked}
                        onChange={(e) => toggle(id, e.target.checked)}
                      />
                      <span>
                        {label(a)}
                        {a.is_active === false && <span className="text-gray-600"> (closed)</span>}
                      </span>
                    </label>
                    {checked && (
                      <label className="min-h-11 inline-flex items-center gap-2 text-sm text-gray-800 sm:shrink-0">
                        <input
                          type="radio"
                          name={`${baseId}-default`}
                          className="w-5 h-5"
                          checked={choice.defaultId === id}
                          onChange={() => makeDefault(id)}
                        />
                        Default
                      </label>
                    )}
                  </div>
                  {checked && (
                    <p className="pl-7 text-sm text-gray-600">
                      {ref ? (
                        <>
                          In a title: <code className="text-gray-900">@{ref}</code>
                        </>
                      ) : (
                        <>
                          To name it in a title, give it a nickname on{' '}
                          <Link href="/dashboard/finance/accounts" className="text-sky-800 underline">
                            Finance → Accounts
                          </Link>{' '}
                          (another ticked account has the same last four digits, or it has none).
                        </>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}

      {tickedCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="min-h-11 inline-flex items-center gap-2 text-sm text-gray-800">
            <input
              type="radio"
              name={`${baseId}-default`}
              className="w-5 h-5"
              checked={choice.defaultId === null}
              disabled={saving}
              onChange={() => makeDefault(null)}
            />
            No default (titles without @ are saved with no account)
          </label>
        </div>
      )}

      {tickedCount === 0 && accounts !== null && accounts.length > 0 && (
        <p className="text-sm text-gray-600">
          No account ticked: tagged money events are saved without an account.
        </p>
      )}
      {tickedCount > 0 && choice.defaultId === null && (
        <p className="text-sm text-amber-900">
          No default chosen: a title without @ is saved with no account.
        </p>
      )}
      {missing && missing.length > 0 && (
        <p className="text-sm text-amber-900">
          {missing.length === 1 ? 'An account ticked before is' : `${missing.length} accounts ticked before are`} no
          longer available; it is skipped.
        </p>
      )}

      <div aria-live="polite" className="min-h-5">
        {saving && (
          <span role="status" className="inline-flex items-center gap-1 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Saving
          </span>
        )}
        {savedNote && !saving && (
          <span role="status" className="text-sm text-green-800">
            Saved
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
