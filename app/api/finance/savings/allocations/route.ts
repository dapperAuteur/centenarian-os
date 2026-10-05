// app/api/finance/savings/allocations/route.ts
// POST: put money into, take it out of, or move it between savings goals.
//   { action: 'allocate', goal_id, amount, transaction_id? }   unallocated -> goal
//   { action: 'release',  goal_id, amount }                    goal -> unallocated
//   { action: 'move',     from_goal_id, to_goal_id, amount }   goal -> goal (same account)
//   { action: 'split',    transaction_id, parts: [{ goal_id, amount }] }
//                                                             a deposit into the funding
//                                                             account -> several goals
//   Optional today: 'YYYY-MM-DD' (the person's local date) stamps allocated_on.
//
// Never moves money between real accounts. Refuses an allocation larger than
// the account's unallocated money, a release or move larger than the goal
// holds, and a split larger than what is left of the deposit.
//
// When a goal with milestone tasks turned on crosses 25/50/75/100%, a
// completed note task is added under the planner Inbox (once per level).
// Response: { ok, inserted, milestones: [{ goal_id, levels, tasks_added }] }.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveInboxMilestone } from '@/lib/planner/inbox';
import { applyAllocation, noteMilestones, parseAllocationRequest } from '@/lib/finance/savings/server';
import { errorResponse, resolveToday } from '@/lib/finance/savings/request';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
  }

  try {
    const today = resolveToday(body.today);
    const result = await applyAllocation(supabase, user.id, parseAllocationRequest(body), today);

    // Milestone notes: the Inbox is resolved at most once per request, and only when a note is due.
    const nowIso = new Date().toISOString();
    let inbox: Promise<string | null> | null = null;
    const resolve = () => (inbox ??= resolveInboxMilestone(supabase, user.id));
    const milestones: { goal_id: string; levels: number[]; tasks_added: number }[] = [];
    for (const crossed of result.crossed) {
      const tasksAdded = await noteMilestones(supabase, crossed, resolve, today, nowIso);
      milestones.push({ goal_id: crossed.goal.id, levels: crossed.levels, tasks_added: tasksAdded });
    }
    return NextResponse.json({ ok: true, inserted: result.inserted, milestones });
  } catch (err) {
    return errorResponse(err);
  }
}
