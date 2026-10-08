// lib/fitness-import/workouts.ts
// Duplicate checks for workout logs brought in from a file.
//
// Data Hub workouts CSV: a workout's identity is (name, ignoring case, date),
// the same rule the import already uses to group a file's rows into one
// workout. A workout already logged under that name on that day is skipped and
// reported as "already logged". There is deliberately no unique key: logging
// by hand allows two sessions with the same name on one day (a morning and an
// evening walk), so "Import anyway" lets the person add a real second session.
//
// Device-sourced logs (scripts/import-garmin-workouts.mjs now, an in-app
// Garmin import later) carry external_id = the Garmin start-time key (the same
// key trips use) and rely on the unique index from migration 224.
//
// Relative imports end in `.ts` for the unit tests.

import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllRows } from './db.ts';
import type { PageResult } from './db.ts';

/** "Leg Day" on 2026-10-01 -> "leg day::2026-10-01". */
export function workoutIdentity(name: string, date: string): string {
  return `${name.trim().toLowerCase()}::${date}`;
}

export interface WorkoutGroupLike {
  name: string;
  date: string;
}

export interface ExistingWorkout {
  id: string;
  name: string;
  date: string;
}

export interface WorkoutSplit<T> {
  toInsert: T[];
  /** Groups already logged under the same name that day (skipped unless allowRepeats). */
  alreadyLogged: T[];
}

/** Splits the file's workouts into new ones and ones already logged. Pure. */
export function splitLoggedWorkouts<T extends WorkoutGroupLike>(
  groups: readonly T[],
  existing: readonly ExistingWorkout[],
  allowRepeats: boolean,
): WorkoutSplit<T> {
  const logged = new Set(existing.map((log) => workoutIdentity(log.name, log.date)));
  const toInsert: T[] = [];
  const alreadyLogged: T[] = [];
  for (const group of groups) {
    if (logged.has(workoutIdentity(group.name, group.date))) {
      alreadyLogged.push(group);
      if (allowRepeats) toInsert.push(group);
    } else {
      toInsert.push(group);
    }
  }
  return { toInsert, alreadyLogged };
}

/** Every workout log between two dates (inclusive), read page by page. */
export async function loadLoggedWorkouts(
  db: SupabaseClient,
  userId: string,
  from: string,
  to: string,
): Promise<ExistingWorkout[]> {
  return readAllRows<ExistingWorkout>('read the workouts already logged', (start, end) =>
    db
      .from('workout_logs')
      .select('id, name, date')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('id', { ascending: true })
      .range(start, end) as unknown as PageResult<ExistingWorkout>,
  );
}

export function describeWorkoutCounts(
  counts: { inserted: number; already_logged: number; imported_anyway: number; invalid: number },
  dryRun: boolean,
): string {
  const parts = [`${counts.inserted} ${counts.inserted === 1 ? 'workout' : 'workouts'} ${dryRun ? 'to add' : 'added'}`];
  if (counts.already_logged > 0) {
    parts.push(
      counts.imported_anyway > 0
        ? `${counts.already_logged} already logged that day (${dryRun ? 'will be imported' : 'imported'} anyway)`
        : `${counts.already_logged} already logged that day (skipped)`,
    );
  }
  if (counts.invalid > 0) parts.push(`${counts.invalid} unreadable ${counts.invalid === 1 ? 'row' : 'rows'}`);
  return parts.join(' · ');
}
