// lib/planner/sync-tasks.ts
// Application-side replacement for BOTH database triggers that write CentOS planner tasks from
// Work.WitUS writes: trg_invoice_due_to_task (migration 148) and trg_pay_date_to_task
// (migration 154). Stage 2, Phase 3 of the database split.
//
// WHY THIS EXISTS
// Both triggers fire on writes to tables moving to Work.WitUS's own database (`invoices` and
// `contractor_jobs`). After the split neither can reach CentOS's `tasks` table, so the behaviour
// has to move into CentOS and be driven by the income event instead.
//
// This is NOT covered by the income_events projection. The projection feeds the expected-payments
// widget and the forecast; the triggers create real rows in the planner hierarchy
// (Work.WitUS Sync > Finances > {Invoice Due Dates, Expected Payments}). Dropping them without
// this would silently delete a feature: due dates and expected payments would stop appearing as
// planner tasks.
//
// Behaviour is a faithful port of both migrations, status for status.

import type { SupabaseClient } from '@supabase/supabase-js';

const ROADMAP_TITLE = 'Work.WitUS Sync';
const GOAL_TITLE = 'Finances';
const MILESTONE_INVOICE = 'Invoice Due Dates';
const MILESTONE_JOB = 'Expected Payments';

export interface InvoiceTaskInput {
  userId: string;
  /** The invoice id. Becomes tasks.source_id, which is how a task is matched on re-delivery. */
  invoiceId: string;
  status: string | null;
  dueDate: string | null;
  label: string | null;
  referenceNumber: string | null;
  amount: number;
  amountPaid?: number | null;
}

/**
 * Find (or lazily create) a milestone under "Work.WitUS Sync > Finances".
 *
 * Ported from migrations 148 and 154, which create two siblings: "Invoice Due Dates" and
 * "Expected Payments". The hierarchy is built only when a task actually needs it, so a user who
 * never receives an invoice or a job never gets an empty roadmap.
 */
async function ensureMilestone(db: SupabaseClient, userId: string, title: string): Promise<string | null> {
  const { data: existing } = await db
    .from('milestones')
    .select('id, goals!inner(id, roadmaps!inner(id, user_id))')
    .eq('title', title)
    .eq('goals.roadmaps.user_id', userId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: roadmap } = await db
    .from('roadmaps')
    .select('id')
    .eq('user_id', userId)
    .eq('title', ROADMAP_TITLE)
    .limit(1)
    .maybeSingle();
  let roadmapId = roadmap?.id as string | undefined;
  if (!roadmapId) {
    const { data: created, error } = await db
      .from('roadmaps')
      .insert({ user_id: userId, title: ROADMAP_TITLE, status: 'active' })
      .select('id')
      .single();
    if (error || !created) return null;
    roadmapId = created.id as string;
  }

  const { data: goal } = await db
    .from('goals')
    .select('id')
    .eq('roadmap_id', roadmapId)
    .eq('title', GOAL_TITLE)
    .limit(1)
    .maybeSingle();
  let goalId = goal?.id as string | undefined;
  if (!goalId) {
    const { data: created, error } = await db
      .from('goals')
      .insert({ roadmap_id: roadmapId, title: GOAL_TITLE, category: 'LIFESTYLE', status: 'active' })
      .select('id')
      .single();
    if (error || !created) return null;
    goalId = created.id as string;
  }

  const { data: milestone, error: msErr } = await db
    .from('milestones')
    .insert({ goal_id: goalId, title, status: 'in_progress' })
    .select('id')
    .single();
  if (msErr || !milestone) return null;
  return milestone.id as string;
}

/**
 * Mirror an invoice's state onto its planner task.
 *
 * Status handling is a direct port of migration 148:
 *   sent      -> create, or update an existing task and un-complete it (the due date may have moved)
 *   overdue   -> prefix "OVERDUE — " and raise priority
 *   paid      -> mark completed, record what was actually received
 *   cancelled -> archive, never delete
 *
 * Returns quietly on any failure. A planner task is a convenience; it must never be the reason
 * an income event is rejected.
 */
export async function syncInvoiceTask(db: SupabaseClient, inv: InvoiceTaskInput): Promise<void> {
  try {
    const { data: existing } = await db
      .from('tasks')
      .select('id')
      .eq('source_type', 'invoice_due')
      .eq('source_id', inv.invoiceId)
      .limit(1)
      .maybeSingle();
    const taskId = existing?.id as string | undefined;

    const activity = `Invoice Due: ${inv.referenceNumber ?? 'N/A'} — ${inv.label ?? 'Unknown'}`;

    if (inv.status === 'sent' || inv.status === 'overdue') {
      const overdue = inv.status === 'overdue';
      if (taskId) {
        await db
          .from('tasks')
          .update({
            date: inv.dueDate,
            activity: overdue ? `OVERDUE — ${activity}` : activity,
            priority: overdue ? 1 : 2,
            completed: false,
            completed_at: null,
            status: 'active',
            archived_at: null,
            estimated_cost: 0,
            revenue: inv.amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', taskId);
        return;
      }
      // Only build the hierarchy when a task is actually going to be created.
      if (!inv.dueDate) return;
      const milestoneId = await ensureMilestone(db, inv.userId, MILESTONE_INVOICE);
      if (!milestoneId) return;
      await db.from('tasks').insert({
        milestone_id: milestoneId,
        date: inv.dueDate,
        time: '09:00',
        activity: overdue ? `OVERDUE — ${activity}` : activity,
        description: `Auto-created from Work.WitUS invoice. Total: $${inv.amount}`,
        tag: 'finance',
        priority: overdue ? 1 : 2,
        completed: false,
        estimated_cost: 0,
        revenue: inv.amount,
        source_type: 'invoice_due',
        source_id: inv.invoiceId,
      });
      return;
    }

    if (!taskId) return;

    if (inv.status === 'paid') {
      await db
        .from('tasks')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          actual_cost: 0,
          revenue: inv.amountPaid ?? inv.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
      return;
    }

    if (inv.status === 'cancelled') {
      await db
        .from('tasks')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
    }
  } catch {
    // Never let planner bookkeeping fail an income event.
  }
}

/** A job's expected-payment task. Ported from migration 154. */
export interface JobTaskInput {
  userId: string;
  /** The contractor_jobs id. Becomes tasks.source_id. */
  jobId: string;
  status: string | null;
  /** est_pay_date. Null means the date was cleared, which archives the task. */
  expectedDate: string | null;
  clientName: string | null;
  jobNumber: string | null;
  /**
   * Already computed by the emitter from job_time_entries (st/ot/dt hours x rates, with the
   * daily/flat fallback). CentOS cannot compute this after the split because those tables move,
   * which is exactly why the event carries the number rather than the inputs.
   */
  expectedAmount: number;
}

/**
 * Mirror a job's expected payment onto its planner task.
 *
 * Ported from migration 154, status for status:
 *   completed / invoiced -> create, or update and revive an existing task
 *   paid                 -> complete it and relabel "Paid: $X — client"
 *   cancelled            -> archive
 *   est_pay_date cleared -> archive, whatever the status
 *
 * Uses source_type 'expected_payment', matching the rows the trigger already created, so the two
 * are idempotent side by side until the trigger is dropped.
 */
export async function syncJobPaymentTask(db: SupabaseClient, job: JobTaskInput): Promise<void> {
  try {
    const { data: existing } = await db
      .from('tasks')
      .select('id')
      .eq('source_type', 'expected_payment')
      .eq('source_id', job.jobId)
      .limit(1)
      .maybeSingle();
    const taskId = existing?.id as string | undefined;
    const now = new Date().toISOString();

    // A cleared pay date retires the task regardless of status — migration 154 checks this first.
    if (!job.expectedDate) {
      if (taskId) {
        await db.from('tasks')
          .update({ status: 'archived', archived_at: now, updated_at: now })
          .eq('id', taskId);
      }
      return;
    }

    const amount = Math.round(job.expectedAmount * 100) / 100;
    const client = job.clientName ?? 'Unknown';

    if (job.status === 'completed' || job.status === 'invoiced') {
      const activity = `Expected Payment: $${amount} — ${client}`;
      const description = `Expected payment for job #${job.jobNumber ?? '?'}. Check your account on this date.`;
      if (taskId) {
        await db.from('tasks').update({
          date: job.expectedDate,
          activity,
          description,
          completed: false,
          completed_at: null,
          status: 'active',
          archived_at: null,
          revenue: amount,
          updated_at: now,
        }).eq('id', taskId);
        return;
      }
      const milestoneId = await ensureMilestone(db, job.userId, MILESTONE_JOB);
      if (!milestoneId) return;
      await db.from('tasks').insert({
        milestone_id: milestoneId,
        date: job.expectedDate,
        time: '09:00',
        activity,
        description,
        tag: 'finance',
        priority: 2,
        completed: false,
        estimated_cost: 0,
        revenue: amount,
        source_type: 'expected_payment',
        source_id: job.jobId,
      });
      return;
    }

    if (!taskId) return;

    if (job.status === 'paid') {
      await db.from('tasks').update({
        completed: true,
        completed_at: now,
        activity: `Paid: $${amount} — ${client}`,
        updated_at: now,
      }).eq('id', taskId);
      return;
    }

    if (job.status === 'cancelled') {
      await db.from('tasks')
        .update({ status: 'archived', archived_at: now, updated_at: now })
        .eq('id', taskId);
    }
  } catch {
    // Never let planner bookkeeping fail an income event.
  }
}
