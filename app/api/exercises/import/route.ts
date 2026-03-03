// app/api/exercises/import/route.ts
// POST: bulk import exercises from CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { MAX_IMPORT_ROWS } from '@/lib/csv/helpers';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface ImportRow {
  name?: string;
  category?: string;
  instructions?: string;
  form_cues?: string;
  video_url?: string;
  primary_muscles?: string;
  default_sets?: string;
  default_reps?: string;
  default_weight_lbs?: string;
  default_duration_sec?: string;
  default_rest_sec?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { rows?: ImportRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_IMPORT_ROWS} rows per import` }, { status: 400 });
  }

  const db = getDb();
  const errors: string[] = [];

  // Load existing categories for auto-creation
  const { data: existingCats } = await db
    .from('exercise_categories')
    .select('id, name')
    .eq('user_id', user.id);

  const catMap = new Map<string, string>();
  for (const c of existingCats || []) {
    catMap.set(c.name.toLowerCase(), c.id);
  }

  // Auto-create missing categories
  const newCatNames = new Set<string>();
  for (const row of rows) {
    if (row.category && !catMap.has(row.category.toLowerCase())) {
      newCatNames.add(row.category);
    }
  }

  if (newCatNames.size > 0) {
    const maxOrder = existingCats?.length ? Math.max(...existingCats.map(() => 0)) : 0;
    let order = maxOrder + (existingCats?.length || 0);
    const catRows = Array.from(newCatNames).map((name) => ({
      user_id: user.id,
      name,
      sort_order: order++,
    }));
    const { data: createdCats } = await db
      .from('exercise_categories')
      .insert(catRows)
      .select();
    for (const c of createdCats || []) {
      catMap.set(c.name.toLowerCase(), c.id);
    }
  }

  // Build payloads
  const payloads: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name?.trim()) {
      errors.push(`Row ${i + 1}: missing name`);
      continue;
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      name: row.name.trim(),
      category_id: row.category ? (catMap.get(row.category.toLowerCase()) || null) : null,
      instructions: row.instructions || null,
      form_cues: row.form_cues || null,
      video_url: row.video_url || null,
      primary_muscles: row.primary_muscles ? row.primary_muscles.split(';').map((m) => m.trim()).filter(Boolean) : null,
      notes: row.notes || null,
    };

    const numericFields: [string, string | undefined][] = [
      ['default_sets', row.default_sets],
      ['default_reps', row.default_reps],
      ['default_weight_lbs', row.default_weight_lbs],
      ['default_duration_sec', row.default_duration_sec],
      ['default_rest_sec', row.default_rest_sec],
    ];
    for (const [key, val] of numericFields) {
      if (val) {
        const num = parseFloat(val);
        if (!isNaN(num)) payload[key] = num;
      }
    }

    payloads.push(payload);
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors }, { status: 400 });
  }

  // Upsert by name (update if name already exists for this user)
  const { data, error } = await db
    .from('exercises')
    .upsert(payloads, { onConflict: 'user_id,name', ignoreDuplicates: false })
    .select('id');

  if (error) {
    // If no unique constraint on (user_id, name), fall back to plain insert
    const { data: insertData, error: insertErr } = await db
      .from('exercises')
      .insert(payloads)
      .select('id');
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({
      imported: insertData?.length || 0,
      skipped: rows.length - payloads.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  }

  return NextResponse.json({
    imported: data?.length || 0,
    skipped: rows.length - payloads.length,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  });
}
