// app/api/contacts/export/route.ts
// GET: export contacts (denormalized with locations) as CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const type = params.get('type');

  let query = supabase
    .from('user_contacts')
    .select('*, contact_locations(*)')
    .order('name', { ascending: true });

  if (type) query = query.eq('contact_type', type);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: string[][] = [];

  for (const contact of data || []) {
    const locations = contact.contact_locations as Array<{
      label: string | null;
      address: string | null;
      lat: number | null;
      lng: number | null;
    }> | null;

    if (locations && locations.length > 0) {
      for (const loc of locations) {
        rows.push([
          contact.name || '',
          contact.contact_type || '',
          contact.notes || '',
          loc.label || '',
          loc.address || '',
          String(loc.lat ?? ''),
          String(loc.lng ?? ''),
        ]);
      }
    } else {
      rows.push([
        contact.name || '',
        contact.contact_type || '',
        contact.notes || '',
        '',
        '',
        '',
        '',
      ]);
    }
  }

  return buildCsvResponse(
    ['Name', 'Contact Type', 'Notes', 'Location Label', 'Address', 'Lat', 'Lng'],
    rows,
    'centenarianos-contacts-export.csv',
  );
}
