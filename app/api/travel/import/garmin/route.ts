import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Activity types to import as trips (others are pure fitness, not travel)
const ACTIVITY_MAP: Record<string, { mode: string; purpose: string }> = {
  'Cycling': { mode: 'bike', purpose: 'exercise' },
  'Indoor Cycling': { mode: 'bike', purpose: 'exercise' },
  'Walking': { mode: 'walk', purpose: 'exercise' },
  'Running': { mode: 'run', purpose: 'exercise' },
  'Treadmill Running': { mode: 'run', purpose: 'exercise' },
  'Hiking': { mode: 'walk', purpose: 'leisure' },
};

function parseDuration(timeStr: string): number | null {
  if (!timeStr || timeStr === '--') return null;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function parseNum(val: string | undefined): number | null {
  if (!val || val === '--') return null;
  const n = parseFloat(val.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

// CO2 factors (kg per mile)
const CO2: Record<string, number> = { bike: 0, walk: 0, run: 0 };

function calcCo2(mode: string, dist: number | null): number | null {
  if (!dist) return null;
  return parseFloat(((CO2[mode] ?? 0) * dist).toFixed(3));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const text = await file.text();
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return NextResponse.json({ error: 'Empty CSV' }, { status: 400 });

  // Parse header
  const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

  const colIdx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const idxType = colIdx('Activity Type');
  const idxDate = colIdx('Date');
  const idxTitle = colIdx('Title');
  const idxDist = colIdx('Distance');
  const idxCals = colIdx('Calories');
  const idxTime = colIdx('Total Time');
  const idxAvgHR = colIdx('Avg HR');
  const idxSteps = colIdx('Steps');
  if (idxType === -1 || idxDate === -1) {
    return NextResponse.json({ error: 'CSV missing required columns (Activity Type, Date)' }, { status: 400 });
  }

  // Fetch existing garmin_activity_ids to skip duplicates
  const { data: existing } = await supabase
    .from('trips')
    .select('garmin_activity_id')
    .eq('user_id', user.id)
    .not('garmin_activity_id', 'is', null);

  const existingIds = new Set((existing || []).map((r) => r.garmin_activity_id));

  const toInsert: object[] = [];
  let skipped = 0;
  let unsupported = 0;

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV fields
    const row = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g)
      ?.map((v) => v.replace(/^"|"$/g, '').trim()) ?? lines[i].split(',').map((v) => v.trim());

    const activityType = row[idxType] ?? '';
    const mapped = ACTIVITY_MAP[activityType];
    if (!mapped) { unsupported++; continue; }

    const rawDate = row[idxDate] ?? '';
    const title = idxTitle !== -1 ? (row[idxTitle] ?? '') : '';
    const garminId = `${rawDate}|${title}`;

    if (existingIds.has(garminId)) { skipped++; continue; }

    // Parse date — Garmin format: "2025-06-08 17:20:53"
    const dateStr = rawDate.split(' ')[0];
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { skipped++; continue; }

    const distance = idxDist !== -1 ? parseNum(row[idxDist]) : null;
    const calories = idxCals !== -1 ? parseNum(row[idxCals]) : null;
    const durationMin = idxTime !== -1 ? parseDuration(row[idxTime] ?? '') : null;
    const avgHR = idxAvgHR !== -1 ? parseNum(row[idxAvgHR]) : null;
    const steps = idxSteps !== -1 ? parseNum(row[idxSteps]) : null;

    const notesParts: string[] = [];
    if (title) notesParts.push(`Activity: ${title}`);
    if (avgHR) notesParts.push(`Avg HR: ${avgHR} bpm`);
    if (steps && mapped.mode === 'walk') notesParts.push(`Steps: ${steps}`);

    toInsert.push({
      user_id: user.id,
      mode: mapped.mode,
      date: dateStr,
      distance_miles: distance,
      duration_min: durationMin,
      calories_burned: calories ? Math.round(calories) : null,
      co2_kg: calcCo2(mapped.mode, distance),
      purpose: mapped.purpose,
      garmin_activity_id: garminId,
      notes: notesParts.length > 0 ? notesParts.join(' | ') : null,
      source: 'garmin_import',
      trip_category: 'fitness',
      tax_category: 'personal',
    });
  }

  // Batch insert in chunks of 100
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { error, count } = await supabase.from('trips').insert(chunk, { count: 'exact' });
    if (error) {
      errors.push(error.message);
    } else {
      inserted += count ?? chunk.length;
    }
  }

  return NextResponse.json({
    inserted,
    skipped,
    unsupported,
    errors: errors.length > 0 ? errors : undefined,
  });
}
