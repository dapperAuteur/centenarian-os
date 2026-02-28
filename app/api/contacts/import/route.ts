// app/api/contacts/import/route.ts
// POST: bulk import contacts (with optional locations) from parsed CSV rows

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const MAX_CONTACT_ROWS = 500;
const VALID_CONTACT_TYPES = new Set(['vendor', 'customer', 'location']);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const rows = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }
  if (rows.length > MAX_CONTACT_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_CONTACT_ROWS} rows per import` }, { status: 400 });
  }

  const db = getDb();

  // Pre-fetch existing contacts for upsert logic
  const { data: existingContacts } = await db
    .from('user_contacts')
    .select('id, name, contact_type, use_count, notes')
    .eq('user_id', user.id);

  const contactKey = (name: string, type: string) => `${name.toLowerCase()}::${type.toLowerCase()}`;
  const contactMap = new Map<string, { id: string; use_count: number; notes: string | null }>();
  for (const c of existingContacts || []) {
    contactMap.set(contactKey(c.name, c.contact_type), {
      id: c.id,
      use_count: c.use_count,
      notes: c.notes,
    });
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  // Process contacts with locations in a batch-friendly way
  const newContacts: Record<string, unknown>[] = [];
  const updateContacts: { id: string; use_count: number; notes: string | null }[] = [];
  // Track which rows need locations and their contact keys
  const locationRows: { contactKey: string; label: string; address: string | null; lat: number | null; lng: number | null }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Validate required: name
    const name = row.name?.trim();
    if (!name) {
      errors.push(`Row ${i + 1}: missing name`);
      skipped++;
      continue;
    }

    // Validate required: contact_type
    const contactType = row.contact_type?.trim()?.toLowerCase();
    if (!contactType || !VALID_CONTACT_TYPES.has(contactType)) {
      errors.push(`Row ${i + 1}: invalid or missing contact_type (must be vendor, customer, location)`);
      skipped++;
      continue;
    }

    const key = contactKey(name, contactType);
    const existing = contactMap.get(key);

    if (existing) {
      // Upsert: update notes if provided and increment use_count
      updateContacts.push({
        id: existing.id,
        use_count: existing.use_count + 1,
        notes: row.notes?.trim() || existing.notes,
      });
    } else {
      // New contact — check if we already plan to insert this key in this batch
      if (!contactMap.has(key)) {
        newContacts.push({
          user_id: user.id,
          name,
          contact_type: contactType,
          notes: row.notes?.trim() || null,
        });
        // Reserve the key so duplicate rows in same batch don't create duplicates
        contactMap.set(key, { id: '', use_count: 1, notes: row.notes?.trim() || null });
      } else {
        // Duplicate within same import batch — just count as updated
        imported++;
      }
    }

    // Collect location data if provided
    const locationLabel = row.location_label?.trim();
    const address = row.address?.trim();
    if (locationLabel || address) {
      locationRows.push({
        contactKey: key,
        label: locationLabel || address || 'Default',
        address: address || null,
        lat: row.lat ? parseFloat(row.lat) : null,
        lng: row.lng ? parseFloat(row.lng) : null,
      });
    }
  }

  // Batch insert new contacts
  if (newContacts.length > 0) {
    const { data: created, error: insertErr } = await db
      .from('user_contacts')
      .insert(newContacts)
      .select('id, name, contact_type');

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Update the map with real IDs
    for (const c of created || []) {
      contactMap.set(contactKey(c.name, c.contact_type), {
        id: c.id,
        use_count: 1,
        notes: null,
      });
    }
    imported += created?.length || 0;
  }

  // Batch update existing contacts
  for (const upd of updateContacts) {
    await db
      .from('user_contacts')
      .update({ use_count: upd.use_count, notes: upd.notes })
      .eq('id', upd.id);
    imported++;
  }

  // Insert contact locations
  if (locationRows.length > 0) {
    const locPayloads: Record<string, unknown>[] = [];
    for (const loc of locationRows) {
      const contact = contactMap.get(loc.contactKey);
      if (contact?.id) {
        locPayloads.push({
          contact_id: contact.id,
          label: loc.label,
          address: loc.address,
          lat: loc.lat,
          lng: loc.lng,
        });
      }
    }

    if (locPayloads.length > 0) {
      await db.from('contact_locations').insert(locPayloads);
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `Imported ${imported} contacts. ${skipped > 0 ? `${skipped} skipped.` : ''}`,
  });
}
