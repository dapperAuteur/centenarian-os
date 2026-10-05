// components/finance/savings/MoneyDialog.tsx
// Moves envelope money for one goal: put money in from the account's
// unallocated balance, take it out (back to unallocated), or move it to
// another goal in the same account. Or splits one deposit into the account
// across several goals. All through POST /api/finance/savings/allocations;
// the server enforces the limits, the form only shows them.
'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { AccountView, GoalView } from '@/lib/finance/savings/server';
import type { Deposit } from '@/lib/finance/savings/logic';
import { formatDate, money } from './format';

export type MoneyAction =
  | { kind: 'allocate' | 'release' | 'move'; goal: GoalView; account: AccountView }
  | { kind: 'split'; deposit: Deposit; account: AccountView };

interface Props {
  action: MoneyAction | null;
  onClose: () => void;
  onDone: (message: string) => void;
  today: string;
}

const inputClass =
  'w-full min-h-11 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500';

export default function MoneyDialog(props: Props) {
  if (!props.action) return null;
  const a = props.action;
  const key = a.kind === 'split' ? `split-${a.deposit.id}` : `${a.kind}-${a.goal.id}`;
  return <MoneyDialogBody key={key} {...props} action={a} />;
}

function MoneyDialogBody({ action, onClose, onDone, today }: Props & { action: MoneyAction }) {
  const ids = useId();
  const [amount, setAmount] = useState('');
  const [toGoal, setToGoal] = useState('');
  const [parts, setParts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = action.account;
  const openGoals = account.goals.filter((g) => g.status !== 'archived');
  const free = Math.max(0, account.unallocated);

  let title = '';
  let limit = 0;
  let limitText = '';
  if (action.kind === 'allocate') {
    title = `Add money to "${action.goal.name}"`;
    limit = free;
    limitText = `${money(free)} is unallocated in ${account.label}.`;
  } else if (action.kind === 'release') {
    title = `Take money out of "${action.goal.name}"`;
    limit = action.goal.saved;
    limitText = `"${action.goal.name}" holds ${money(action.goal.saved)}. What you take out goes back to unallocated; it stays in ${account.label}.`;
  } else if (action.kind === 'move') {
    title = `Move money from "${action.goal.name}"`;
    limit = action.goal.saved;
    limitText = `"${action.goal.name}" holds ${money(action.goal.saved)}. Moving between goals doesn't change the account balance.`;
  } else if (action.kind === 'split') {
    title = 'Allocate a deposit';
    limit = Math.min(action.deposit.remaining, free);
    limitText = `${money(action.deposit.remaining)} of this ${money(action.deposit.amount)} deposit on ${formatDate(action.deposit.transaction_date)} is left to allocate.`;
  }

  const splitTotal = Object.values(parts).reduce((s, v) => s + (Number(v) || 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let body: Record<string, unknown>;
    if (action.kind === 'split') {
      body = {
        action: 'split',
        transaction_id: action.deposit.id,
        parts: Object.entries(parts)
          .filter(([, v]) => v !== '' && Number(v) !== 0)
          .map(([goal_id, v]) => ({ goal_id, amount: v })),
      };
    } else if (action.kind === 'move') {
      if (!toGoal) {
        setError('Pick the goal to move the money to.');
        return;
      }
      body = { action: 'move', from_goal_id: action.goal.id, to_goal_id: toGoal, amount };
    } else {
      body = { action: action.kind, goal_id: action.goal.id, amount };
    }
    setBusy(true);
    try {
      const res = await fetch('/api/finance/savings/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, today }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'That could not be saved.');
      const noted = (result.milestones ?? []).reduce((s: number, m: { tasks_added: number }) => s + m.tasks_added, 0);
      const base =
        action.kind === 'split'
          ? `${money(splitTotal)} of the deposit allocated.`
          : action.kind === 'move'
            ? `${money(Number(amount))} moved.`
            : action.kind === 'release'
              ? `${money(Number(amount))} back to unallocated.`
              : `${money(Number(amount))} added.`;
      onDone(noted > 0 ? `${base} Milestone noted in your planner Inbox.` : base);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={title} size="sm">
      <form onSubmit={submit} className="p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
        <p className="text-sm text-gray-600">{limitText}</p>

        {action.kind === 'split' ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-gray-700 mb-1">How much goes to each goal</legend>
            {action.deposit.description && <p className="text-xs text-gray-500">{action.deposit.description}</p>}
            {openGoals.length === 0 && <p className="text-sm text-gray-500">This account has no open goals yet.</p>}
            {openGoals.map((g) => (
              <div key={g.id} className="flex items-center gap-3">
                <label htmlFor={`${ids}-part-${g.id}`} className="flex-1 text-sm text-gray-700">
                  {g.name}
                  {g.monthly_needed !== null && g.monthly_needed > 0 && (
                    <span className="block text-xs text-gray-500">Needs {money(g.monthly_needed)} a month</span>
                  )}
                </label>
                <input
                  id={`${ids}-part-${g.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  className={`${inputClass} w-32`}
                  value={parts[g.id] ?? ''}
                  onChange={(e) => setParts((p) => ({ ...p, [g.id]: e.target.value }))}
                />
              </div>
            ))}
            <p className={`text-sm ${splitTotal > limit + 0.001 ? 'text-amber-800' : 'text-gray-600'}`} aria-live="polite">
              Total {money(splitTotal)} of {money(limit)} available.
            </p>
          </fieldset>
        ) : (
          <>
            {action.kind === 'move' && (
              <div>
                <label htmlFor={`${ids}-to`} className="block text-sm font-medium text-gray-700 mb-1">Move to</label>
                <select id={`${ids}-to`} className={inputClass} value={toGoal} onChange={(e) => setToGoal(e.target.value)} required>
                  <option value="">Pick a goal</option>
                  {openGoals
                    .filter((g) => g.id !== action.goal.id)
                    .map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor={`${ids}-amount`} className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <div className="flex gap-2">
                <input
                  id={`${ids}-amount`}
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={limit > 0 ? limit : undefined}
                  step={0.01}
                  className={inputClass}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                {limit > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(limit.toFixed(2))}
                    className="min-h-11 px-3 shrink-0 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    All {money(limit)}
                  </button>
                )}
              </div>
              {action.kind === 'allocate' && action.goal.monthly_needed !== null && action.goal.monthly_needed > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(Math.min(action.goal.monthly_needed!, free).toFixed(2))}
                  className="mt-2 min-h-11 text-sm font-medium text-sky-700 hover:text-sky-800"
                >
                  Use this month&apos;s need ({money(action.goal.monthly_needed)})
                </button>
              )}
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || (action.kind === 'split' && splitTotal <= 0)}
            className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {action.kind === 'release' ? 'Take out' : action.kind === 'move' ? 'Move' : 'Allocate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
