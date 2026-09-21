// lib/planner/system-roadmaps.ts
// Roadmaps the app creates on its own ("system" roadmaps), and how to find them whether or not
// migration 199 (roadmaps.system_kind) has been applied yet.
//
// Two kinds exist:
//   inbox           - "Inbox > Inbox > Inbox", where one-field task capture files tasks
//                     (lib/planner/inbox.ts).
//   work_witus_sync - "Work.WitUS Sync > Finances > ...", where Work.WitUS income-event tasks go
//                     (lib/planner/sync-tasks.ts).
//
// BEFORE AND AFTER MIGRATION 199
// The code ships before BAM applies the migration, so every read and write here tolerates the
// column being absent: a missing-column error (Postgres 42703, PostgREST PGRST204) switches to the
// title, which is how these roadmaps were found before. After the migration the column is
// authoritative and the title is only a fallback.
//
// Safe to import from client and server code: no server-only imports.

import type { SupabaseClient } from '@supabase/supabase-js';

export type SystemRoadmapKind = 'inbox' | 'work_witus_sync';

/** The title each system roadmap is created with. Also the pre-migration fallback lookup key. */
export const SYSTEM_ROADMAP_TITLES: Record<SystemRoadmapKind, string> = {
  inbox: 'Inbox',
  work_witus_sync: 'Work.WitUS Sync',
};

/** Short label for UI badges. */
export const SYSTEM_ROADMAP_LABEL = 'Auto';

/**
 * True when Postgres or PostgREST says a column does not exist.
 * 42703 = undefined_column (a filter or select on it); PGRST204 = PostgREST cannot find the
 * column in its schema cache (an insert or update that sets it).
 */
export function isMissingColumnError(error: { code?: string } | null | undefined): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204');
}

/**
 * Which system roadmap a row is, or null for a person's own roadmap.
 *
 * When the row has a `system_kind` key (migration 199 applied, row selected with `*`), that value
 * is the answer. When the key is absent (migration not applied yet), FALLBACK to the title. The
 * fallback can mislabel a person's own roadmap named "Inbox"; it disappears once the column exists.
 */
export function systemKindOf(roadmap: { title?: string | null; system_kind?: string | null }): SystemRoadmapKind | null {
  if ('system_kind' in roadmap && roadmap.system_kind !== undefined) {
    return roadmap.system_kind === 'inbox' || roadmap.system_kind === 'work_witus_sync'
      ? roadmap.system_kind
      : null;
  }
  // Fallback: pre-migration rows carry no system_kind key.
  if (roadmap.title === SYSTEM_ROADMAP_TITLES.inbox) return 'inbox';
  if (roadmap.title === SYSTEM_ROADMAP_TITLES.work_witus_sync) return 'work_witus_sync';
  return null;
}

export interface FoundRoadmap {
  id: string | null;
  /** True when the roadmaps.system_kind column does not exist yet (migration 199 not applied). */
  columnMissing: boolean;
  /**
   * True when a lookup failed for another reason. Callers must not create a roadmap then: a
   * transient error would otherwise leave the user with a duplicate.
   */
  failed: boolean;
}

/**
 * Find the user's system roadmap of this kind: by system_kind first, then by title.
 *
 * A title match found while the column exists is an untagged roadmap (created before the
 * migration, or by a person); it is tagged here so later lookups use the column. Oldest wins when
 * there are duplicates, so every caller converges on the same row.
 */
export async function findSystemRoadmapId(
  db: SupabaseClient,
  userId: string,
  kind: SystemRoadmapKind,
  opts: { activeOnly?: boolean } = {},
): Promise<FoundRoadmap> {
  let columnMissing = false;

  let byKind = db
    .from('roadmaps')
    .select('id')
    .eq('user_id', userId)
    .eq('system_kind', kind);
  if (opts.activeOnly) byKind = byKind.eq('status', 'active');
  const { data: tagged, error: kindErr } = await byKind
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (kindErr) {
    if (!isMissingColumnError(kindErr)) {
      console.error(`[system-roadmaps] ${kind} lookup failed:`, kindErr.message);
      return { id: null, columnMissing: false, failed: true };
    }
    columnMissing = true;
  } else if (tagged?.id) {
    return { id: tagged.id as string, columnMissing: false, failed: false };
  }

  // Fallback: the title the app has always created this roadmap with.
  let byTitle = db
    .from('roadmaps')
    .select('id')
    .eq('user_id', userId)
    .eq('title', SYSTEM_ROADMAP_TITLES[kind]);
  if (!columnMissing) byTitle = byTitle.is('system_kind', null);
  if (opts.activeOnly) byTitle = byTitle.eq('status', 'active');
  const { data: titled, error: titleErr } = await byTitle
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (titleErr) {
    console.error(`[system-roadmaps] ${kind} title lookup failed:`, titleErr.message);
    return { id: null, columnMissing, failed: true };
  }
  if (!titled?.id) return { id: null, columnMissing, failed: false };

  if (!columnMissing) {
    // Adopt it: tag so the column finds it next time. Best effort; the id is right either way.
    const { error: tagErr } = await db
      .from('roadmaps')
      .update({ system_kind: kind })
      .eq('id', titled.id);
    if (tagErr && !isMissingColumnError(tagErr)) {
      console.error(`[system-roadmaps] tagging ${kind} roadmap failed:`, tagErr.message);
    }
  }
  return { id: titled.id as string, columnMissing, failed: false };
}

/**
 * Insert a system roadmap, setting every NOT NULL column (start_date and end_date have no
 * default; leaving them out fails the insert, see lib/planner/sync-tasks.ts header).
 *
 * Sets system_kind, and retries once without it if the column does not exist yet.
 */
export async function insertSystemRoadmap(
  db: SupabaseClient,
  userId: string,
  kind: SystemRoadmapKind,
  dates: { startDate: string; endDate: string },
  opts: { skipKind?: boolean; description?: string | null } = {},
): Promise<string | null> {
  const base = {
    user_id: userId,
    title: SYSTEM_ROADMAP_TITLES[kind],
    description: opts.description ?? null,
    status: 'active',
    start_date: dates.startDate,
    end_date: dates.endDate,
  };

  if (!opts.skipKind) {
    const { data, error } = await db
      .from('roadmaps')
      .insert({ ...base, system_kind: kind })
      .select('id')
      .single();
    if (!error && data) return data.id as string;
    if (!isMissingColumnError(error)) {
      console.error(`[system-roadmaps] ${kind} roadmap insert failed:`, error?.message);
      return null;
    }
    // Column not there yet (migration 199 not applied): fall through and insert without it.
  }

  const { data, error } = await db
    .from('roadmaps')
    .insert(base)
    .select('id')
    .single();
  if (error || !data) {
    console.error(`[system-roadmaps] ${kind} roadmap insert failed:`, error?.message);
    return null;
  }
  return data.id as string;
}
