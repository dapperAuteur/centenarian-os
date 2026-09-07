// lib/planner/invoice-task-sync.ts
// Application-side replacement for the trg_invoice_due_to_task database trigger
// (migration 148). Stage 2, Phase 3 of the database split.
//
// WHY THIS EXISTS
// That trigger fires on writes to `invoices` — a table that is moving to Work.WitUS's own
// database. Once the split happens the trigger cannot reach CentOS's `tasks` table, so the
// behaviour has to move into CentOS and be driven by the income event instead.
//
// This is NOT covered by the income_events projection. The projection feeds the expected-payments
// widget and the forecast; the trigger creates real rows in the planner hierarchy
// (Work.WitUS Sync > Finances > Invoice Due Dates). Dropping the trigger without this would
// silently delete a feature: invoice due dates would stop appearing as planner tasks.
//
// Behaviour is a faithful port of migration 148, status for status.

import type { SupabaseClient } from '@supabase/supabase-js';

const ROADMAP_TITLE = 'Work.WitUS Sync';
const GOAL_TITLE = 'Finances';
const MILESTONE_TITLE = 'Invoice Due Dates';

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
 * Find (or lazily create) the "Work.WitUS Sync > Finances > Invoice Due Dates" milestone.
 * Ported from migration 148: the hierarchy is only built when a task actually needs it, so a
 * user who never receives an invoice never gets an empty roadmap.
 */
async function ensureMilestone(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data: existing } = await db
    .from('milestones')
    .select('id, goals!inner(id, roadmaps!inner(id, user_id))')
    .eq('title', MILESTONE_TITLE)
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
    .insert({ goal_id: goalId, title: MILESTONE_TITLE, status: 'in_progress' })
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
      const milestoneId = await ensureMilestone(db, inv.userId);
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
