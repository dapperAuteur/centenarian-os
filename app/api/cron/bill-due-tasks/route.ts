// app/api/cron/bill-due-tasks/route.ts
// GET: the daily bill-due job (vercel.json cron, "0 11 * * *", 11:00 UTC = 7am US Eastern).
//
// Guard: Authorization: Bearer {CRON_SECRET}, the header Vercel Cron sends when CRON_SECRET is
// set, same check as app/api/cron/calendar-sync/route.ts. Middleware does not cover /api/*, so
// this is the only gate.
//
// For every user with an active credit_card or loan account: upsert the due-date and promo
// deadline planner tasks (Inbox > Inbox > Bills), complete the ones a linked payment has paid,
// and send the email reminders the user switched on (debt_reminder_settings). Rules:
// lib/finance/debt/bill-tasks.ts. Stops starting new users before the time budget runs out; the
// next run catches up (each step is idempotent).
//
// -> 200 { ready, users, skipped_for_time, created, updated, completed, archived, emailed, errors }
//    (counts only: no ids, names or emails) · 401 bad or missing secret
//    ready: false means migration 211 isn't applied; nothing was written.

import { NextRequest, NextResponse } from 'next/server';
import { syncBillDueTasks } from '@/lib/finance/debt/bill-tasks';
import { DEBT_ACCOUNT_TYPES } from '@/lib/finance/debt/overview';
import { serverToday } from '@/lib/finance/debt/server';
import { getServiceDb } from '@/lib/finance/debt/route-helpers';

export const maxDuration = 300;
const BUDGET_MS = 270_000;
const PAGE = 1000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const deadline = Date.now() + BUDGET_MS;
  const db = getServiceDb();
  const today = serverToday();

  const userIds = new Set<string>();
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db
      .from('financial_accounts')
      .select('user_id')
      .eq('is_active', true)
      .in('account_type', [...DEBT_ACCOUNT_TYPES])
      .order('user_id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error('[api/cron/bill-due-tasks] listing accounts failed:', error.message);
      return NextResponse.json({ error: 'Could not list card and loan accounts.' }, { status: 500 });
    }
    for (const row of (data ?? []) as { user_id: string }[]) userIds.add(row.user_id);
    if ((data ?? []).length < PAGE) break;
  }

  const totals = { created: 0, updated: 0, completed: 0, archived: 0, emailed: 0, errors: 0 };
  const ids = [...userIds];
  let index = 0;
  for (; index < ids.length; index += 1) {
    if (deadline - Date.now() < 10_000) break;
    try {
      const r = await syncBillDueTasks(db, ids[index], today, { sendEmail: true });
      if (!r.ready) {
        return NextResponse.json({ ready: false, users: 0, skipped_for_time: 0, ...totals });
      }
      totals.created += r.created;
      totals.updated += r.updated;
      totals.completed += r.completed;
      totals.archived += r.archived;
      totals.emailed += r.emailed;
      totals.errors += r.errors;
    } catch (err) {
      totals.errors += 1;
      console.error('[api/cron/bill-due-tasks] user failed:', err instanceof Error ? err.message : 'unknown error');
    }
  }

  return NextResponse.json({ ready: true, users: index, skipped_for_time: ids.length - index, ...totals });
}
