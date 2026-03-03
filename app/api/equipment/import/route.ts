// app/api/equipment/import/route.ts
// POST: bulk import equipment from parsed CSV rows

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { MAX_IMPORT_ROWS, validateDate } from '@/lib/csv/helpers';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_CONDITIONS = new Set(['excellent', 'good', 'fair', 'poor']);
const VALID_OWNERSHIP  = new Set(['own', 'access']);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const rows = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_IMPORT_ROWS} rows per import` }, { status: 400 });
  }

  const db = getDb();

  // Pre-fetch existing categories for this user
  const { data: existingCategories } = await db
    .from('equipment_categories')
    .select('id, name')
    .eq('user_id', user.id);

  const categoryMap = new Map<string, string>();
  for (const c of existingCategories || []) {
    categoryMap.set(c.name.toLowerCase(), c.id);
  }

  // Collect category names that need to be created
  const newCategoryNames = new Set<string>();
  for (const row of rows) {
    const catName = row.category_name?.trim();
    if (catName && !categoryMap.has(catName.toLowerCase())) {
      newCategoryNames.add(catName);
    }
  }

  // Batch-create missing categories
  if (newCategoryNames.size > 0) {
    const catPayloads = Array.from(newCategoryNames).map((name) => ({
      user_id: user.id,
      name,
    }));
    const { data: created } = await db
      .from('equipment_categories')
      .insert(catPayloads)
      .select('id, name');

    for (const c of created || []) {
      categoryMap.set(c.name.toLowerCase(), c.id);
    }
  }

  const payloads: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Validate required: name
    const name = row.name?.trim();
    if (!name) {
      errors.push(`Row ${i + 1}: missing name`);
      skipped++;
      continue;
    }

    // Resolve category
    const categoryId = row.category_name?.trim()
      ? categoryMap.get(row.category_name.trim().toLowerCase()) ?? null
      : null;

    const purchasePrice = row.purchase_price ? parseFloat(row.purchase_price) : null;
    const currentValue = row.current_value ? parseFloat(row.current_value) : purchasePrice;

    // Validate optional dates
    const purchaseDate = row.purchase_date?.trim() && validateDate(row.purchase_date.trim())
      ? row.purchase_date.trim()
      : null;
    const warrantyExpires = row.warranty_expires?.trim() && validateDate(row.warranty_expires.trim())
      ? row.warranty_expires.trim()
      : null;

    // Validate condition
    const condition = row.condition?.trim()?.toLowerCase();
    const resolvedCondition = condition && VALID_CONDITIONS.has(condition) ? condition : 'good';

    // Validate ownership_type
    const ownershipRaw = row.ownership_type?.trim()?.toLowerCase();
    const resolvedOwnership = ownershipRaw && VALID_OWNERSHIP.has(ownershipRaw) ? ownershipRaw : 'own';

    payloads.push({
      user_id: user.id,
      name,
      category_id: categoryId,
      brand: row.brand?.trim() || null,
      model: row.model?.trim() || null,
      serial_number: row.serial_number?.trim() || null,
      purchase_date: purchaseDate,
      purchase_price: purchasePrice,
      current_value: currentValue,
      warranty_expires: warrantyExpires,
      condition: resolvedCondition,
      notes: row.notes?.trim() || null,
      ownership_type: resolvedOwnership,
    });
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors.slice(0, 10) }, { status: 400 });
  }

  const { data, error } = await db
    .from('equipment')
    .insert(payloads)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const imported = data?.length || 0;
  return NextResponse.json({
    imported,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `Imported ${imported} equipment items. ${skipped > 0 ? `${skipped} skipped.` : ''}`,
  });
}
