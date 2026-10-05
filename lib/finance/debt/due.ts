// lib/finance/debt/due.ts
// Card and loan payment due dates: which ones are coming up, whether they are paid, what the
// planner task says, and when a reminder goes out. Pure; the writes are in bill-tasks.ts.
//
// WHICH DUE DATES (window: 10 days back to 45 days ahead of today)
//   - The latest statement's due date, with its minimum payment and new balance.
//   - Every date on the account's due day of the month (financial_accounts.due_date, else the day
//     of the statement's due date) in the window, without amounts. One within 7 days of the
//     statement's due date is the same bill and is dropped (issuers shift a weekend due date).
//   - Each deferred-interest promo that has not expired: a task 30 days before its expiry, once
//     that date is inside the window.
//
// PAID
//   A due date is paid when linked payments (overview.ts isLinkedPayment) dated in its cycle add
//   up to the minimum, or to anything above zero when the minimum isn't known. The cycle runs from
//   the day after the statement closed (statement due dates) or a month before the due date
//   (day-of-month due dates) to 10 days after the due date, so a late payment still counts.

import { earlyPaymentSavings } from './amortize.ts';
import { addDays, addMonthsToDate, daysBetween, isIsoDate, withDay } from './dates.ts';
import type { DebtSummary, TxnRow } from './overview.ts';
import { isLinkedPayment } from './overview.ts';

export const DUE_WINDOW_DAYS = 45;
export const DUE_LOOKBACK_DAYS = 10;
/** A payment up to this many days after the due date still counts for that cycle. */
export const LATE_PAYMENT_GRACE_DAYS = 10;
export const PROMO_TASK_LEAD_DAYS = 30;
/** The in-app "Due soon" banner shows due dates this many days ahead, and on the day. */
export const DUE_SOON_DAYS = 3;
/** Days early used in the early-payment estimate on a task. */
export const EARLY_DAYS_EXAMPLE = 10;

export type DueKind = 'payment_due' | 'promo_deadline';

export interface DueItem {
  /** Stable identity: account + kind + date (+ promo key). */
  key: string;
  accountId: string;
  accountName: string;
  accountType: 'credit_card' | 'loan';
  kind: DueKind;
  /** The task's date: the due date, or 30 days before a promo's expiry. */
  date: string;
  /** The due date itself, or the promo's expiry. */
  deadline: string;
  /** '' for payment due dates. */
  promoKey: string;
  minimum: number | null;
  /** The statement's new balance: pay this to avoid interest (cards). */
  statementBalance: number | null;
  apr: number | null;
  /** First day a payment counts toward this due date. */
  cycleStart: string;
  fromStatement: boolean;
  promo?: {
    description: string;
    balance: number;
    requiredMonthly: number;
    backInterest: number | null;
    backInterestEstimated: boolean;
  };
}

export function dueItemKey(accountId: string, kind: DueKind, deadline: string, promoKey = ''): string {
  return `${accountId}|${kind}|${deadline}|${promoKey}`;
}

/** Every date on day-of-month `day` between `from` and `to`, inclusive. */
export function dayOfMonthDates(day: number, from: string, to: string): string[] {
  const out: string[] = [];
  let probe = withDay(from, day);
  if (probe < from) probe = withDay(addMonthsToDate(withDay(from, 1), 1), day);
  for (let guard = 0; guard < 24 && probe <= to; guard += 1) {
    out.push(probe);
    probe = withDay(addMonthsToDate(withDay(probe, 1), 1), day);
  }
  return out;
}

/** Due dates and promo deadlines for one debt in the window around `today`. */
export function upcomingDueItems(debt: DebtSummary, today: string): DueItem[] {
  const from = addDays(today, -DUE_LOOKBACK_DAYS);
  const to = addDays(today, DUE_WINDOW_DAYS);
  const items: DueItem[] = [];
  const base = { accountId: debt.id, accountName: debt.name, accountType: debt.type, apr: debt.apr };

  const st = debt.latestStatement;
  const statementDue = st?.dueDate && isIsoDate(st.dueDate) ? st.dueDate : null;
  if (statementDue && statementDue >= from && statementDue <= to) {
    items.push({
      ...base,
      key: dueItemKey(debt.id, 'payment_due', statementDue),
      kind: 'payment_due',
      date: statementDue,
      deadline: statementDue,
      promoKey: '',
      minimum: st!.minimumPayment,
      statementBalance: st!.newBalance,
      cycleStart: addDays(st!.periodEnd, 1),
      fromStatement: true,
    });
  }

  if (debt.dueDay) {
    for (const date of dayOfMonthDates(debt.dueDay, from, to)) {
      if (statementDue && Math.abs(daysBetween(statementDue, date)) <= 7) continue;
      // A due date before the statement's own belongs to a cycle the statement already closed.
      if (statementDue && date < statementDue) continue;
      items.push({
        ...base,
        key: dueItemKey(debt.id, 'payment_due', date),
        kind: 'payment_due',
        date,
        deadline: date,
        promoKey: '',
        minimum: null,
        statementBalance: null,
        cycleStart: addDays(addMonthsToDate(date, -1), 1),
        fromStatement: false,
      });
    }
  }

  for (const p of debt.promos) {
    if (p.expired || p.expiresOn < today) continue;
    const taskDate = addDays(p.expiresOn, -PROMO_TASK_LEAD_DAYS);
    if (taskDate > to) continue;
    items.push({
      ...base,
      key: dueItemKey(debt.id, 'promo_deadline', p.expiresOn, p.id),
      kind: 'promo_deadline',
      date: taskDate,
      deadline: p.expiresOn,
      promoKey: p.id,
      minimum: null,
      statementBalance: null,
      cycleStart: today,
      fromStatement: true,
      promo: {
        description: p.description,
        balance: p.balance,
        requiredMonthly: p.requiredMonthly,
        backInterest: p.backInterest,
        backInterestEstimated: p.backInterestEstimated,
      },
    });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

/** Linked payments into the item's account that count toward it, in dollars. */
export function paidTowardItem(item: DueItem, txns: TxnRow[]): number {
  if (item.kind !== 'payment_due') return 0;
  const end = addDays(item.deadline, LATE_PAYMENT_GRACE_DAYS);
  let cents = 0;
  for (const t of txns) {
    if (t.account_id !== item.accountId || !isLinkedPayment(t)) continue;
    if (t.transaction_date < item.cycleStart || t.transaction_date > end) continue;
    cents += Math.round(Math.abs(Number(t.amount)) * 100);
  }
  return cents / 100;
}

export function isItemPaid(item: DueItem, txns: TxnRow[]): boolean {
  if (item.kind !== 'payment_due') return false;
  const paid = paidTowardItem(item, txns);
  if (item.minimum !== null && item.minimum > 0) return paid + 0.005 >= item.minimum;
  return paid > 0;
}

// ── Wording ────────────────────────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 21", or "Oct 21, 2027" when the year differs from `today`'s. */
export function shortDate(date: string, today?: string): string {
  const label = `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
  return today && today.slice(0, 4) !== date.slice(0, 4) ? `${label}, ${date.slice(0, 4)}` : label;
}

export function money(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function dueTaskTitle(item: DueItem, today: string): string {
  if (item.kind === 'promo_deadline') {
    const p = item.promo!;
    return `Clear ${item.accountName} promo — ${money(p.balance)} by ${shortDate(item.deadline, today)} to avoid deferred interest`;
  }
  const due = shortDate(item.deadline, today);
  if (item.minimum !== null && item.statementBalance !== null && item.statementBalance > 0) {
    return `Pay ${item.accountName} — ${money(item.minimum)} minimum (${money(item.statementBalance)} statement balance to avoid interest) — due ${due}`;
  }
  if (item.minimum !== null) return `Pay ${item.accountName} — ${money(item.minimum)} minimum — due ${due}`;
  return `Pay ${item.accountName} — due ${due}`;
}

export function dueTaskDescription(item: DueItem, today: string): string {
  const lines: string[] = [];
  if (item.kind === 'promo_deadline') {
    const p = item.promo!;
    lines.push(`${p.description}: ${money(p.balance)} must be paid off by ${shortDate(item.deadline, today)}.`);
    lines.push(`Pay about ${money(p.requiredMonthly)} a month to clear it in time.`);
    if (p.backInterest !== null) {
      lines.push(
        `If any of it is left after that date, ${p.backInterestEstimated ? 'an estimated ' : ''}${money(p.backInterest)} of deferred interest is charged at once.`,
      );
    }
  } else {
    if (!item.fromStatement) lines.push('Amount: check your statement (no statement imported for this due date yet).');
    if (item.accountType === 'credit_card' && item.statementBalance !== null && item.statementBalance > 0) {
      lines.push(`Paying the full statement balance (${money(item.statementBalance)}) by the due date avoids interest on purchases this cycle.`);
    }
    const amount = item.statementBalance && item.statementBalance > 0 ? item.statementBalance : item.minimum;
    const saved = amount ? earlyPaymentSavings(amount, item.apr, EARLY_DAYS_EXAMPLE) : 0;
    if (amount && saved > 0 && item.apr) {
      lines.push(
        `Paying ${money(amount)} ${EARLY_DAYS_EXAMPLE} days early saves about ${money(saved)} at ${item.apr}% APR (estimate: amount × APR ÷ 365 × days early).`,
      );
    }
  }
  lines.push('Created by CentenarianOS from your card and loan due dates. It is marked done when a linked payment to this account comes in.');
  return lines.join('\n');
}

// ── Reminders ──────────────────────────────────────────────────────────────────────────────────

export const REMINDER_SETTINGS = ['off', '3_days', '1_day', 'both'] as const;
export type ReminderSetting = (typeof REMINDER_SETTINGS)[number];

export function isReminderSetting(value: unknown): value is ReminderSetting {
  return typeof value === 'string' && (REMINDER_SETTINGS as readonly string[]).includes(value);
}

/**
 * Which email reminder is due for an unpaid payment due date today, if any.
 * '3_days' goes out 3 to 2 days before, '1_day' 1 day before or on the day; each once (the
 * caller passes what was already sent). A missed cron run still sends late rather than never.
 */
export function reminderToSend(
  item: DueItem,
  today: string,
  setting: ReminderSetting,
  sent: { threeDay: boolean; oneDay: boolean },
): '3_days' | '1_day' | null {
  if (setting === 'off' || item.kind !== 'payment_due') return null;
  const days = daysBetween(today, item.deadline);
  if (days < 0) return null;
  if ((setting === '1_day' || setting === 'both') && days <= 1 && !sent.oneDay) return '1_day';
  if ((setting === '3_days' || setting === 'both') && days <= 3 && days >= 2 && !sent.threeDay) return '3_days';
  return null;
}

export interface DueSoonEntry {
  key: string;
  accountId: string;
  accountName: string;
  dueDate: string;
  daysUntil: number;
  minimum: number | null;
  statementBalance: number | null;
}

/** Unpaid payment due dates from today to DUE_SOON_DAYS ahead, soonest first. */
export function dueSoon(items: DueItem[], txns: TxnRow[], today: string): DueSoonEntry[] {
  return items
    .filter((i) => i.kind === 'payment_due')
    .map((i) => ({ i, days: daysBetween(today, i.deadline) }))
    .filter(({ i, days }) => days >= 0 && days <= DUE_SOON_DAYS && !isItemPaid(i, txns))
    .sort((a, b) => a.days - b.days)
    .map(({ i, days }) => ({
      key: i.key,
      accountId: i.accountId,
      accountName: i.accountName,
      dueDate: i.deadline,
      daysUntil: days,
      minimum: i.minimum,
      statementBalance: i.statementBalance,
    }));
}
