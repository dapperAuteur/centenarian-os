// app/api/finance/debt/reminders/route.ts
// The per-user email reminder setting for card/loan due dates (debt_reminder_settings,
// migration 211). Emails go out from the daily cron (/api/cron/bill-due-tasks).
//
// GET -> 200 { setting: 'off' | '3_days' | '1_day' | 'both', ready }   (ready = migration 211)
// PUT { setting } -> 200 { setting, ready: true } · 400 bad value
//     -> 503 { error, code: 'migration_required' } until migration 211 is applied.

import { NextRequest, NextResponse } from 'next/server';
import { loadReminderSetting } from '@/lib/finance/debt/bill-tasks';
import { isReminderSetting } from '@/lib/finance/debt/due';
import { DEBT_NOT_READY, isMissingTable } from '@/lib/finance/debt/server';
import { currentUserId, errorResponse, getServiceDb, unauthorized } from '@/lib/finance/debt/route-helpers';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    return NextResponse.json(await loadReminderSetting(getServiceDb(), userId));
  } catch (err) {
    return errorResponse(err, 'api/finance/debt/reminders');
  }
}

export async function PUT(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const body = (await request.json().catch(() => null)) as { setting?: unknown } | null;
  if (!isReminderSetting(body?.setting)) {
    return NextResponse.json({ error: 'setting must be off, 3_days, 1_day or both.' }, { status: 400 });
  }
  const db = getServiceDb();
  const { error } = await db
    .from('debt_reminder_settings')
    .upsert({ user_id: userId, email_reminders: body.setting, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) {
    if (isMissingTable(error, 'debt_reminder_settings')) return NextResponse.json(DEBT_NOT_READY, { status: 503 });
    return errorResponse(new Error(`Could not save the setting: ${error.message}`), 'api/finance/debt/reminders');
  }
  return NextResponse.json({ setting: body.setting, ready: true });
}
