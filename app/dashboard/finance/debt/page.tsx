// app/dashboard/finance/debt/page.tsx
// Debts: every card and loan with APR, balance, minimum, due date and promo deadlines; interest
// paid by year; a payoff calculator; the debt-free plan builder; due-date reminders.
// Opening the page also brings the due-date planner tasks (Inbox > Inbox > Bills) up to date.
// Data: GET /api/finance/debt, /interest, /saved-plans; POST /due-tasks; PUT /reminders.
// Rules: lib/finance/debt/*. Every projection is an estimate and says so.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import { todayLocal } from '@/lib/dates/local';
import { money } from '@/lib/finance/debt/due';
import DueSoonBanner from '@/components/finance/debt/DueSoonBanner';
import DebtList from '@/components/finance/debt/DebtList';
import InterestPaid from '@/components/finance/debt/InterestPaid';
import PayoffCalculator from '@/components/finance/debt/PayoffCalculator';
import PlanBuilder from '@/components/finance/debt/PlanBuilder';
import ReminderSettings from '@/components/finance/debt/ReminderSettings';
import type { DebtOverviewResponse } from '@/components/finance/debt/types';

type TaskSync = { kind: 'ok'; text: string } | { kind: 'notice'; text: string } | null;

export default function DebtPage() {
  useTrackPageView('finance', '/dashboard/finance/debt');
  const [data, setData] = useState<DebtOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskSync, setTaskSync] = useState<TaskSync>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/finance/debt?today=${todayLocal()}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'Could not load your debts.');
      return;
    }
    setData(body as DebtOverviewResponse);
  }, []);

  useEffect(() => {
    load();
    // Keep due-date planner tasks current. Quiet unless something changed or the table is missing.
    fetch(`/api/finance/debt/due-tasks?today=${todayLocal()}`, { method: 'POST' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.status === 503) {
          setTaskSync({ kind: 'notice', text: 'Due dates will appear as planner tasks once migration 211 is applied. Run migration 211 first.' });
        } else if (res.ok && (body.created > 0 || body.completed > 0)) {
          const parts = [
            body.created > 0 ? `${body.created} due-date ${body.created === 1 ? 'task' : 'tasks'} added` : '',
            body.completed > 0 ? `${body.completed} marked paid` : '',
          ].filter(Boolean);
          setTaskSync({ kind: 'ok', text: `Planner (Inbox › Bills): ${parts.join(', ')}.` });
        }
      })
      .catch(() => {});
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link href="/dashboard/finance" className="inline-flex items-center gap-1 min-h-11 text-sm text-sky-700 hover:text-sky-800">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Finance
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Debt payoff</h1>
        <p className="text-sm text-gray-600 mt-1">
          Your cards and loans, the interest they cost, and a plan to pay them off. Figures come from your imported statements
          where there are any. Projections are estimates, not financial advice.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
      )}

      {!data && !error && (
        <div role="status" className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading your debts...
        </div>
      )}

      {data && (
        <>
          <DueSoonBanner items={data.dueSoon} showLink={false} />

          {taskSync && (
            <p
              role="status"
              className={`text-sm rounded-lg p-3 border ${taskSync.kind === 'ok' ? 'text-green-800 bg-green-50 border-green-200' : 'text-amber-900 bg-amber-50 border-amber-200'}`}
            >
              {taskSync.text}
            </p>
          )}

          {!data.statementsReady && (
            <p role="status" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Statement details (APRs, minimums, due dates, promos) need migration 209. Until then, rates come from each account.
            </p>
          )}

          {data.debts.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <dt className="text-sm text-gray-500">Total owed</dt>
                <dd className="text-2xl font-bold text-gray-900">{money(data.totals.balance)}</dd>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <dt className="text-sm text-gray-500">Minimums each month</dt>
                <dd className="text-2xl font-bold text-gray-900">{money(data.totals.minimums)}</dd>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <dt className="text-sm text-gray-500">Interest paid this year</dt>
                <dd className="text-2xl font-bold text-gray-900">{money(data.totals.interestYtd)}</dd>
              </div>
            </dl>
          )}

          <section aria-labelledby="debts-heading" className="space-y-3">
            <h2 id="debts-heading" className="text-lg font-semibold text-gray-900">Your debts</h2>
            <DebtList debts={data.debts} today={data.today} />
          </section>

          {data.debts.length > 0 && (
            <>
              <section aria-labelledby="interest-heading" className="space-y-3">
                <h2 id="interest-heading" className="text-lg font-semibold text-gray-900">Interest paid</h2>
                <InterestPaid initial={data.interest} />
              </section>

              <section aria-labelledby="calc-heading" className="space-y-3">
                <h2 id="calc-heading" className="text-lg font-semibold text-gray-900">Payoff calculator</h2>
                <PayoffCalculator debts={data.debts} today={data.today} />
              </section>

              <section aria-labelledby="plan-heading" className="space-y-3">
                <h2 id="plan-heading" className="text-lg font-semibold text-gray-900">Debt-free plan</h2>
                <PlanBuilder debts={data.debts} today={data.today} />
              </section>
            </>
          )}

          <section aria-labelledby="reminders-heading" className="space-y-3">
            <h2 id="reminders-heading" className="text-lg font-semibold text-gray-900">Reminders</h2>
            <ReminderSettings initial={data.reminders.setting} ready={data.reminders.ready} />
          </section>
        </>
      )}
    </div>
  );
}
