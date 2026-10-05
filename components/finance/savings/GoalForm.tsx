// components/finance/savings/GoalForm.tsx
// Create or edit a savings goal: name, what it's for, target, target date, the
// real account it draws from (institution + last four), starting amount,
// priority, an optional link to a planned trip or an equipment item, the
// milestone-task toggle, and notes. Saves through POST /api/finance/savings
// (create) or PATCH /api/finance/savings/goals/[id] (edit).
'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { GOAL_KINDS, GOAL_KIND_LABEL } from '@/lib/finance/savings/logic';
import type { GoalKind } from '@/lib/finance/savings/logic';
import type { FundingOption, GoalView, LinkOption } from '@/lib/finance/savings/server';

export interface GoalPrefill {
  name?: string;
  kind?: GoalKind;
  target_amount?: string;
  target_date?: string;
  linked_trip_id?: string;
  linked_equipment_id?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  goal?: GoalView | null;
  prefill?: GoalPrefill | null;
  fundingOptions: FundingOption[];
  linkOptions: { trips: LinkOption[]; equipment: LinkOption[] };
  today: string;
}

const inputClass =
  'w-full min-h-11 px-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

export default function GoalForm(props: Props) {
  // Remount the form body whenever it opens for a different goal or prefill.
  if (!props.open) return null;
  const key = props.goal?.id ?? `new-${JSON.stringify(props.prefill ?? {})}`;
  return <GoalFormBody key={key} {...props} />;
}

function GoalFormBody({ open, onClose, onSaved, goal, prefill, fundingOptions, linkOptions, today }: Props) {
  const ids = useId();
  const editing = !!goal;
  const [name, setName] = useState(goal?.name ?? prefill?.name ?? '');
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? prefill?.kind ?? 'other');
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : prefill?.target_amount ?? '');
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? prefill?.target_date ?? '');
  const [account, setAccount] = useState(goal?.funding_account_id ?? fundingOptions[0]?.id ?? '');
  const [starting, setStarting] = useState(goal ? String(goal.starting_amount) : '');
  const [priority, setPriority] = useState(String(goal?.priority ?? 1));
  const initialLink = goal?.linked_trip_id
    ? `trip:${goal.linked_trip_id}`
    : goal?.linked_equipment_id
      ? `equipment:${goal.linked_equipment_id}`
      : prefill?.linked_trip_id
        ? `trip:${prefill.linked_trip_id}`
        : prefill?.linked_equipment_id
          ? `equipment:${prefill.linked_equipment_id}`
          : '';
  const [link, setLink] = useState(initialLink);
  const [milestoneTasks, setMilestoneTasks] = useState(goal?.milestone_tasks ?? false);
  const [notes, setNotes] = useState(goal?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedTripMissing = link.startsWith('trip:') && !linkOptions.trips.some((t) => `trip:${t.id}` === link);
  const linkedEquipmentMissing =
    link.startsWith('equipment:') && !linkOptions.equipment.some((e) => `equipment:${e.id}` === link);

  const pickLink = (value: string) => {
    setLink(value);
    // Fill empty fields from the linked item: its budget or price, its date, its name.
    if (value.startsWith('trip:')) {
      const trip = linkOptions.trips.find((t) => `trip:${t.id}` === value);
      if (trip) {
        if (!name.trim()) setName(trip.label);
        if (!target && trip.amount) setTarget(String(trip.amount));
        if (!targetDate && trip.date && trip.date > today) setTargetDate(trip.date);
        if (kind === 'other') setKind('trip');
      }
    } else if (value.startsWith('equipment:')) {
      const item = linkOptions.equipment.find((e) => `equipment:${e.id}` === value);
      if (item) {
        if (!name.trim()) setName(`Replace ${item.label}`);
        if (!target && item.amount) setTarget(String(item.amount));
        if (kind === 'other') setKind('equipment');
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: Record<string, unknown> = {
      name,
      kind,
      target_amount: target,
      target_date: targetDate || null,
      funding_account_id: account,
      starting_amount: starting === '' ? 0 : starting,
      priority: Number(priority),
      linked_trip_id: link.startsWith('trip:') ? link.slice(5) : null,
      linked_equipment_id: link.startsWith('equipment:') ? link.slice(10) : null,
      milestone_tasks: milestoneTasks,
      notes,
    };
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/finance/savings/goals/${goal!.id}` : '/api/finance/savings', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...body, today } : body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'The goal could not be saved.');
      onSaved(editing ? `"${name.trim()}" saved.` : `"${name.trim()}" created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The goal could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={editing ? 'Edit savings goal' : 'New savings goal'} size="md">
      <form onSubmit={submit} className="p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor={`${ids}-name`} className={labelClass}>Name</label>
          <input id={`${ids}-name`} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${ids}-kind`} className={labelClass}>What it&apos;s for</label>
            <select id={`${ids}-kind`} className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as GoalKind)}>
              {GOAL_KINDS.map((k) => (
                <option key={k} value={k}>{GOAL_KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${ids}-priority`} className={labelClass}>Priority (1 = first)</label>
            <input
              id={`${ids}-priority`}
              type="number"
              min={1}
              max={99}
              step={1}
              className={inputClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              aria-describedby={`${ids}-priority-help`}
            />
            <p id={`${ids}-priority-help`} className="text-xs text-gray-500 mt-1">
              Goals with a lower number get the first claim on your monthly surplus.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${ids}-target`} className={labelClass}>Target amount ($)</label>
            <input
              id={`${ids}-target`}
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              className={inputClass}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor={`${ids}-date`} className={labelClass}>Target date (optional)</label>
            <input id={`${ids}-date`} type="date" className={inputClass} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label htmlFor={`${ids}-account`} className={labelClass}>Account the money sits in</label>
          {fundingOptions.length === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Add a savings, checking or cash account on the Accounts page first.
            </p>
          ) : (
            <select id={`${ids}-account`} className={inputClass} value={account} onChange={(e) => setAccount(e.target.value)} required aria-describedby={`${ids}-account-help`}>
              {!account && <option value="">Pick an account</option>}
              {fundingOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} ({o.account_type})
                </option>
              ))}
            </select>
          )}
          <p id={`${ids}-account-help`} className="text-xs text-gray-500 mt-1">
            The goal is an envelope inside this real account. Several goals can share one account.
          </p>
        </div>

        <div>
          <label htmlFor={`${ids}-starting`} className={labelClass}>Already saved for this ($, optional)</label>
          <input
            id={`${ids}-starting`}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            className={inputClass}
            value={starting}
            onChange={(e) => setStarting(e.target.value)}
            aria-describedby={`${ids}-starting-help`}
          />
          <p id={`${ids}-starting-help`} className="text-xs text-gray-500 mt-1">
            Money already in the account that belongs to this goal. It comes out of the account&apos;s unallocated money.
          </p>
        </div>

        <div>
          <label htmlFor={`${ids}-link`} className={labelClass}>For a planned trip or equipment item (optional)</label>
          <select id={`${ids}-link`} className={inputClass} value={link} onChange={(e) => pickLink(e.target.value)}>
            <option value="">Nothing linked</option>
            {(linkedTripMissing || linkedEquipmentMissing) && <option value={link}>{goal?.linked_label ?? 'The linked item'}</option>}
            {linkOptions.trips.length > 0 && (
              <optgroup label="Planned trips">
                {linkOptions.trips.map((t) => (
                  <option key={t.id} value={`trip:${t.id}`}>{t.label}</option>
                ))}
              </optgroup>
            )}
            {linkOptions.equipment.length > 0 && (
              <optgroup label="Equipment">
                {linkOptions.equipment.map((e) => (
                  <option key={e.id} value={`equipment:${e.id}`}>{e.label}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="flex items-start gap-3">
          <input
            id={`${ids}-milestones`}
            type="checkbox"
            className="mt-1 h-5 w-5 accent-sky-600"
            checked={milestoneTasks}
            onChange={(e) => setMilestoneTasks(e.target.checked)}
          />
          <label htmlFor={`${ids}-milestones`} className="text-sm text-gray-700">
            Note milestones in my planner
            <span className="block text-xs text-gray-500">
              When this goal reaches 25%, 50%, 75% and 100%, add a completed note to the planner Inbox.
            </span>
          </label>
        </div>

        <div>
          <label htmlFor={`${ids}-notes`} className={labelClass}>Notes (optional)</label>
          <textarea id={`${ids}-notes`} className={`${inputClass} py-2 min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || fundingOptions.length === 0}
            className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {editing ? 'Save goal' : 'Create goal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
