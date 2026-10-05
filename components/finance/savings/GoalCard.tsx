// components/finance/savings/GoalCard.tsx
// One savings goal: progress bar, saved / target, monthly needed, on track or
// behind (amber), projected date, whether it fits the monthly surplus, and the
// actions (add, take out, move, edit, pause / resume, done, archive, delete).
'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Link2, Minus, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import type { GoalView } from '@/lib/finance/savings/server';
import { formatDate, money } from './format';

interface Props {
  goal: GoalView;
  canMove: boolean;
  hasUnallocated: boolean;
  busy: boolean;
  onAllocate: () => void;
  onRelease: () => void;
  onMove: () => void;
  onEdit: () => void;
  onStatus: (status: 'active' | 'paused' | 'done' | 'archived') => void;
  onDelete: () => void;
}

const TRACK: Record<GoalView['track'], { label: string; className: string }> = {
  reached: { label: 'Reached', className: 'bg-green-100 text-green-800' },
  on_track: { label: 'On track', className: 'bg-sky-100 text-sky-800' },
  behind: { label: 'Behind', className: 'bg-amber-100 text-amber-900' },
  no_date: { label: 'No target date', className: 'bg-gray-100 text-gray-700' },
  paused: { label: 'Paused', className: 'bg-gray-100 text-gray-700' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700' },
};

export default function GoalCard({ goal, canMove, hasUnallocated, busy, onAllocate, onRelease, onMove, onEdit, onStatus, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pct = Math.min(100, Math.max(0, goal.percent));
  const track = goal.status === 'archived' ? { label: 'Archived', className: 'bg-gray-100 text-gray-700' } : goal.status === 'done' ? { label: 'Done', className: 'bg-gray-100 text-gray-700' } : TRACK[goal.track];
  const menuId = `goal-menu-${goal.id}`;
  const open = goal.status === 'active' || goal.status === 'paused';

  return (
    <article className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-3" aria-labelledby={`goal-${goal.id}-name`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`goal-${goal.id}-name`} className="font-semibold text-gray-900 truncate">{goal.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-fuchsia-50 text-fuchsia-700">{goal.kind_label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${track.className}`}>{track.label}</span>
            <span className="text-xs text-gray-500">Priority {goal.priority}</span>
          </div>
          {goal.linked_label && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Link2 className="w-3 h-3" aria-hidden="true" /> For {goal.linked_label}
            </p>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={`More actions for ${goal.name}`}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div id={menuId} role="menu" className="absolute right-0 z-10 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
              {[
                goal.status === 'active' && { label: 'Pause', run: () => onStatus('paused') },
                (goal.status === 'paused' || goal.status === 'done' || goal.status === 'archived') && { label: 'Make active again', run: () => onStatus('active') },
                open && { label: 'Mark done', run: () => onStatus('done') },
                goal.status !== 'archived' && { label: goal.saved > 0 ? 'Archive and release money' : 'Archive', run: () => onStatus('archived') },
                { label: 'Delete goal', run: onDelete, danger: true },
              ]
                .filter((item): item is { label: string; run: () => void; danger?: boolean } => !!item)
                .map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false);
                      item.run();
                    }}
                    className={`w-full text-left min-h-11 px-3 text-sm hover:bg-gray-50 disabled:opacity-50 ${item.danger ? 'text-red-700' : 'text-gray-700'}`}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-gray-900">{money(goal.saved)}</span>
          <span className="text-gray-500">of {money(goal.target_amount)}</span>
        </div>
        <div
          className="h-2.5 bg-gray-100 rounded-full mt-1 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label={`${goal.name}: ${goal.percent}% saved`}
        >
          <div className={`h-full rounded-full ${goal.track === 'reached' ? 'bg-green-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">{goal.percent}% saved{goal.remaining > 0 ? `, ${money(goal.remaining)} to go` : ''}</p>
      </div>

      {goal.remaining > 0 && open && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-gray-500">Needed a month</dt>
            <dd className="text-gray-900">
              {goal.monthly_needed === null ? 'Set a target date' : goal.past_due ? `${money(goal.monthly_needed)} now` : money(goal.monthly_needed)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Target date</dt>
            <dd className="text-gray-900">{goal.target_date ? formatDate(goal.target_date) : 'None'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Your pace</dt>
            <dd className="text-gray-900">{goal.pace > 0 ? `${money(goal.pace)} a month` : 'Nothing added lately'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Projected</dt>
            <dd className={goal.track === 'behind' ? 'text-amber-900 font-medium' : 'text-gray-900'}>
              {goal.projected_date ? formatDate(goal.projected_date) : 'Not at this pace'}
            </dd>
          </div>
        </dl>
      )}

      {goal.past_due && goal.remaining > 0 && open && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          The target date has passed. Pick a new date or add the rest.
        </p>
      )}

      {goal.status === 'active' && goal.fit.fits === true && (
        <p className="text-sm text-gray-700">Fits your monthly surplus ({money(goal.fit.available ?? 0)} left for it after higher priorities).</p>
      )}
      {goal.status === 'active' && goal.fit.fits === false && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Doesn&apos;t fit: it needs {money(goal.monthly_needed ?? 0)} a month and {money(goal.fit.available ?? 0)} of your surplus is left for it.
          {goal.fit.fits_from
            ? ` Saving that much each month, it would be reached by ${formatDate(goal.fit.fits_from)}.`
            : ' Higher-priority goals use the whole surplus.'}
        </p>
      )}

      {open && (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 mt-auto pt-1">
          <button
            type="button"
            onClick={onAllocate}
            disabled={busy || !hasUnallocated}
            className="min-h-11 px-3 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            title={hasUnallocated ? undefined : 'Nothing is unallocated in this account'}
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> Add money
          </button>
          <button
            type="button"
            onClick={onRelease}
            disabled={busy || goal.saved <= 0}
            className="min-h-11 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Minus className="w-4 h-4" aria-hidden="true" /> Take out
          </button>
          {canMove && (
            <button
              type="button"
              onClick={onMove}
              disabled={busy || goal.saved <= 0}
              className="min-h-11 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <ArrowRightLeft className="w-4 h-4" aria-hidden="true" /> Move
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="min-h-11 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" /> Edit
          </button>
        </div>
      )}
      {!open && (
        <div className="flex gap-2 mt-auto">
          <button
            type="button"
            onClick={onEdit}
            className="min-h-11 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" /> Edit
          </button>
          {goal.status === 'done' && goal.saved > 0 && (
            <button
              type="button"
              onClick={onRelease}
              disabled={busy}
              className="min-h-11 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Minus className="w-4 h-4" aria-hidden="true" /> Take out
            </button>
          )}
        </div>
      )}
    </article>
  );
}
