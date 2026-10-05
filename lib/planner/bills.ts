// lib/planner/bills.ts
// The "Bills" milestone: Inbox > Inbox > Bills, where card and loan due-date tasks go
// (lib/finance/debt/bill-tasks.ts, plans/61 section 5).
//
// It sits under the existing Inbox system roadmap and goal on purpose: roadmaps.system_kind's
// CHECK allows only 'inbox' and 'work_witus_sync' (migration 200), and changing a CHECK on a
// shared table is a coordinated change. A milestone under the Inbox goal needs nothing new.
// Found by title under that goal; an archived "Bills" milestone is replaced, not reused.

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveInboxGoal, resolveMilestoneUnderGoal } from '@/lib/planner/inbox';

export const BILLS_MILESTONE_TITLE = 'Bills';

/** Find or create the user's Bills milestone and return its id, or null if it could not be built. */
export async function resolveBillsMilestone(db: SupabaseClient, userId: string): Promise<string | null> {
  const goalId = await resolveInboxGoal(db, userId);
  if (!goalId) return null;
  return resolveMilestoneUnderGoal(db, goalId, BILLS_MILESTONE_TITLE);
}
