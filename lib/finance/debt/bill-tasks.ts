// lib/finance/debt/bill-tasks.ts
// Card/loan due dates and promo deadlines as planner tasks under Inbox > Inbox > Bills, plus the
// optional email reminders. Run by the daily cron (/api/cron/bill-due-tasks) for every user with
// an active card or loan, and by POST /api/finance/debt/due-tasks when someone opens the debt page.
//
// IDEMPOTENT
//   Each due date (lib/finance/debt/due.ts upcomingDueItems) has one bill_due_items row
//   (migration 211), unique on (user, account, kind, due date, promo key). Its task carries
//   source_type = 'bill_due' and source_id = that row's id. Running twice changes nothing.
//
// WHAT A RUN DOES
//   - New due date, not yet paid: create the row and the task (dated on the due date, 09:00).
//   - Existing task: refresh its title, description and date when they changed (a newer statement
//     brings the minimum), and bring it back if it had been archived.
//   - Paid (linked payments in the cycle reach the minimum): mark the task completed and stamp
//     bill_due_items.paid_at. A task someone completed by hand is never reopened.
//   - A future due date that is no longer generated (the statement moved it, the account was
//     closed): archive its open task. A promo deadline that disappears before its expiry was paid
//     off: its task is completed.
//
// Never throws for a single item: a planner task is a convenience and must not break the page or
// the cron for other users. Errors are counted and logged without personal data.

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveBillsMilestone } from '@/lib/planner/bills';
import { getResend } from '@/lib/email/resend';
import { addDays } from './dates.ts';
import {
  dueItemKey,
  dueTaskDescription,
  dueTaskTitle,
  isItemPaid,
  isReminderSetting,
  money,
  reminderToSend,
  shortDate,
  DUE_LOOKBACK_DAYS,
} from './due.ts';
import type { DueItem, DueKind, ReminderSetting } from './due.ts';
import { buildOverview, isMissingTable, loadDebtData } from './server.ts';
import type { DebtData } from './server.ts';

export const BILL_SOURCE_TYPE = 'bill_due';
const TASK_TIME = '09:00';

interface BillRow {
  id: string;
  account_id: string;
  kind: DueKind;
  due_date: string;
  promo_key: string;
  task_id: string | null;
  paid_at: string | null;
  reminder_3d_sent_at: string | null;
  reminder_1d_sent_at: string | null;
}

interface TaskRow {
  id: string;
  activity: string | null;
  description: string | null;
  date: string | null;
  completed: boolean | null;
  status: string | null;
}

export interface BillSyncResult {
  ready: boolean;
  created: number;
  updated: number;
  completed: number;
  archived: number;
  errors: number;
  emailed: number;
}

const rowKey = (r: Pick<BillRow, 'account_id' | 'kind' | 'due_date' | 'promo_key'>) =>
  dueItemKey(r.account_id, r.kind, r.due_date, r.promo_key);

/** Sync one user's due-date tasks. Pass `data` when the caller already loaded it. */
export async function syncBillDueTasks(
  db: SupabaseClient,
  userId: string,
  today: string,
  opts: { data?: DebtData; sendEmail?: boolean; userEmail?: string | null } = {},
): Promise<BillSyncResult> {
  const result: BillSyncResult = { ready: true, created: 0, updated: 0, completed: 0, archived: 0, errors: 0, emailed: 0 };
  const data = opts.data ?? (await loadDebtData(db, userId));
  const overview = buildOverview(data, today);
  const items = overview.dueItems;

  const { data: existingRows, error: rowsErr } = await db
    .from('bill_due_items')
    .select('id, account_id, kind, due_date, promo_key, task_id, paid_at, reminder_3d_sent_at, reminder_1d_sent_at')
    .eq('user_id', userId)
    .gte('due_date', addDays(today, -DUE_LOOKBACK_DAYS));
  if (rowsErr) {
    if (isMissingTable(rowsErr, 'bill_due_items')) return { ...result, ready: false };
    console.error('[bill-due] loading items failed:', rowsErr.message);
    return { ...result, errors: 1 };
  }
  const rows = new Map<string, BillRow>(((existingRows ?? []) as BillRow[]).map((r) => [rowKey(r), r]));

  const taskIds = [...rows.values()].map((r) => r.task_id).filter((id): id is string => !!id);
  const tasks = new Map<string, TaskRow>();
  if (taskIds.length) {
    const { data: taskRows, error: taskErr } = await db
      .from('tasks')
      .select('id, activity, description, date, completed, status')
      .in('id', taskIds);
    if (taskErr) {
      console.error('[bill-due] loading tasks failed:', taskErr.message);
      return { ...result, errors: 1 };
    }
    for (const t of (taskRows ?? []) as TaskRow[]) tasks.set(t.id, t);
  }

  let milestoneId: string | null | undefined;
  const milestone = async () => {
    if (milestoneId === undefined) milestoneId = await resolveBillsMilestone(db, userId);
    return milestoneId;
  };
  const now = () => new Date().toISOString();
  const seen = new Set<string>();

  for (const item of items) {
    seen.add(item.key);
    try {
      const paid = isItemPaid(item, data.txns);
      let row = rows.get(item.key);
      if (!row) {
        // Paid before we ever saw it: nothing to remind about.
        if (paid) continue;
        const { data: inserted, error } = await db
          .from('bill_due_items')
          .upsert(
            { user_id: userId, account_id: item.accountId, kind: item.kind, due_date: item.deadline, promo_key: item.promoKey },
            { onConflict: 'user_id,account_id,kind,due_date,promo_key' },
          )
          .select('id, account_id, kind, due_date, promo_key, task_id, paid_at, reminder_3d_sent_at, reminder_1d_sent_at')
          .single();
        if (error || !inserted) throw new Error(error?.message ?? 'insert failed');
        row = inserted as BillRow;
        rows.set(item.key, row);
      }

      const title = dueTaskTitle(item, today);
      const description = dueTaskDescription(item, today);
      const task = row.task_id ? tasks.get(row.task_id) : undefined;

      if (!task) {
        if (paid) {
          if (!row.paid_at) await db.from('bill_due_items').update({ paid_at: now(), updated_at: now() }).eq('id', row.id);
          continue;
        }
        const ms = await milestone();
        if (!ms) throw new Error('could not build the Bills milestone');
        const { data: created, error } = await db
          .from('tasks')
          .insert({
            milestone_id: ms,
            date: item.date,
            time: TASK_TIME,
            activity: title,
            description,
            tag: 'finance',
            priority: item.kind === 'promo_deadline' ? 1 : 2,
            completed: false,
            estimated_cost: item.minimum ?? 0,
            revenue: 0,
            source_type: BILL_SOURCE_TYPE,
            source_id: row.id,
          })
          .select('id')
          .single();
        if (error || !created) throw new Error(error?.message ?? 'task insert failed');
        await db.from('bill_due_items').update({ task_id: created.id, updated_at: now() }).eq('id', row.id);
        result.created += 1;
        continue;
      }

      if (paid && !task.completed) {
        await db
          .from('tasks')
          .update({ completed: true, completed_at: now(), activity: title, updated_at: now() })
          .eq('id', task.id);
        await db.from('bill_due_items').update({ paid_at: now(), updated_at: now() }).eq('id', row.id);
        result.completed += 1;
        continue;
      }
      if (paid && !row.paid_at) {
        await db.from('bill_due_items').update({ paid_at: now(), updated_at: now() }).eq('id', row.id);
      }
      const archived = task.status === 'archived';
      if (!task.completed && (archived || task.activity !== title || task.description !== description || task.date !== item.date)) {
        await db
          .from('tasks')
          .update({
            activity: title,
            description,
            date: item.date,
            estimated_cost: item.minimum ?? 0,
            ...(archived ? { status: 'active', archived_at: null } : {}),
            updated_at: now(),
          })
          .eq('id', task.id);
        result.updated += 1;
      }
    } catch (err) {
      result.errors += 1;
      console.error('[bill-due] item failed:', err instanceof Error ? err.message : 'unknown error');
    }
  }

  // Rows for future dates that are no longer generated.
  for (const [key, row] of rows) {
    if (seen.has(key) || row.due_date < today || !row.task_id) continue;
    const task = tasks.get(row.task_id);
    if (!task || task.completed || task.status === 'archived') continue;
    try {
      if (row.kind === 'promo_deadline') {
        await db.from('tasks').update({ completed: true, completed_at: now(), updated_at: now() }).eq('id', task.id);
        await db.from('bill_due_items').update({ paid_at: now(), updated_at: now() }).eq('id', row.id);
        result.completed += 1;
      } else {
        await db
          .from('tasks')
          .update({ status: 'archived', archived_at: now(), updated_at: now() })
          .eq('id', task.id);
        result.archived += 1;
      }
    } catch (err) {
      result.errors += 1;
      console.error('[bill-due] cleanup failed:', err instanceof Error ? err.message : 'unknown error');
    }
  }

  if (opts.sendEmail) {
    result.emailed = await sendDueReminders(db, userId, today, items, rows, data, opts.userEmail ?? null).catch((err) => {
      result.errors += 1;
      console.error('[bill-due] reminders failed:', err instanceof Error ? err.message : 'unknown error');
      return 0;
    });
  }
  return result;
}

/** The user's email reminder setting; 'off' when unset or before migration 211. */
export async function loadReminderSetting(
  db: SupabaseClient,
  userId: string,
): Promise<{ setting: ReminderSetting; ready: boolean }> {
  const { data, error } = await db
    .from('debt_reminder_settings')
    .select('email_reminders')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error, 'debt_reminder_settings')) return { setting: 'off', ready: false };
    throw new Error(`Could not load reminder settings: ${error.message}`);
  }
  const value = (data as { email_reminders?: string } | null)?.email_reminders;
  return { setting: isReminderSetting(value) ? value : 'off', ready: true };
}

async function sendDueReminders(
  db: SupabaseClient,
  userId: string,
  today: string,
  items: DueItem[],
  rows: Map<string, BillRow>,
  data: DebtData,
  knownEmail: string | null,
): Promise<number> {
  const { setting } = await loadReminderSetting(db, userId);
  if (setting === 'off') return 0;

  const toSend: { item: DueItem; row: BillRow; which: '3_days' | '1_day' }[] = [];
  for (const item of items) {
    const row = rows.get(item.key);
    if (!row || isItemPaid(item, data.txns)) continue;
    const which = reminderToSend(item, today, setting, {
      threeDay: !!row.reminder_3d_sent_at,
      oneDay: !!row.reminder_1d_sent_at,
    });
    if (which) toSend.push({ item, row, which });
  }
  if (!toSend.length) return 0;

  let email = knownEmail;
  if (!email) {
    const { data: authUser } = await db.auth.admin.getUserById(userId);
    email = authUser?.user?.email ?? null;
  }
  if (!email) return 0;

  const lines = toSend.map(({ item }) => {
    const amount =
      item.minimum !== null
        ? ` ${money(item.minimum)} minimum${item.statementBalance ? ` (${money(item.statementBalance)} statement balance to avoid interest)` : ''}`
        : '';
    return `<li><strong>${escapeHtml(item.accountName)}</strong>:${escapeHtml(amount)} due ${escapeHtml(shortDate(item.deadline, today))}</li>`;
  });
  // The site URL comes from the deployment's own env. When neither is set the email has no link
  // (no guessed domain) and names the page instead.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const pageLink = appUrl
    ? `<a href="${appUrl}/dashboard/finance/debt">Open your debts in CentenarianOS</a>`
    : 'Open Finance, then Debt, in CentenarianOS to see them.';
  const html = `
    <p>Payment due soon:</p>
    <ul>${lines.join('')}</ul>
    <p>Paying a card's full statement balance by the due date avoids interest on purchases. Amounts are from your latest imported statement.</p>
    <p>${pageLink}</p>
    <p style="color:#6b7280;font-size:12px">You get this because due-date email reminders are on. Turn them off on the Debt page, under Reminders.</p>`;

  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@centenarianos.com',
    to: email,
    subject: toSend.length === 1 ? `Payment due ${shortDate(toSend[0].item.deadline, today)}: ${toSend[0].item.accountName}` : `${toSend.length} payments due soon`,
    html,
  });

  const stamp = new Date().toISOString();
  for (const { row, which } of toSend) {
    await db
      .from('bill_due_items')
      .update(which === '3_days' ? { reminder_3d_sent_at: stamp, updated_at: stamp } : { reminder_1d_sent_at: stamp, updated_at: stamp })
      .eq('id', row.id);
  }
  return toSend.length;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
