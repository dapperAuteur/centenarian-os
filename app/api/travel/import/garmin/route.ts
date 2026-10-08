// app/api/travel/import/garmin/route.ts
// POST: import a Garmin Connect Activities.csv into trips, without duplicates.
//
// Form fields: file (the CSV), dryRun ('1' = preview only, nothing written),
// includePossibleMatches ('1' = also import activities that look like a trip
// you logged yourself). The rules live in lib/fitness-import/garmin-trips.ts:
// one Garmin activity is one local start time, whatever its title says now.
//
// Work.WitUS has its own copy of this route on the shared trips table. It
// never sets trips.external_id, and nothing here changes how it behaves.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FitnessImportError } from '@/lib/fitness-import/db';
import { describeGarminCounts, importGarminActivities } from '@/lib/fitness-import/garmin-trips';

/** Activities listed back in the preview; the counts always cover the whole file. */
const PREVIEW_ROWS = 500;

const isOn = (value: FormDataEntryValue | null) => value === '1' || value === 'true';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const dryRun = isOn(formData.get('dryRun'));
  try {
    const result = await importGarminActivities(supabase, {
      userId: user.id,
      text: await file.text(),
      dryRun,
      includePossibleMatches: isOn(formData.get('includePossibleMatches')),
    });
    const { counts } = result;
    return NextResponse.json({
      dryRun,
      ...counts,
      needs_migration: result.needsMigration,
      message: `${describeGarminCounts(counts, dryRun)}.`,
      activities: result.activities
        .filter((a) => a.status !== 'new' || dryRun)
        .slice(0, PREVIEW_ROWS)
        .map((a) => ({
          line: a.line,
          start: a.start,
          type: a.activityType,
          title: a.title,
          distance_miles: a.distance_miles,
          duration_min: a.duration_min,
          status: a.status,
          match_trip_id: a.matchTripId,
          match_reason: a.matchReason,
          match_date: a.matchDate,
        })),
      invalid_rows: result.invalid.slice(0, 20),
      errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    if (error instanceof FitnessImportError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
