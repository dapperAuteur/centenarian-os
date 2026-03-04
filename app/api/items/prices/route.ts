// app/api/items/prices/route.ts
// GET: query price history for an item
// POST: record a new price entry

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const category = searchParams.get('category');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let query = serviceClient
    .from('item_prices')
    .select('*')
    .eq('user_id', user.id)
    .order('recorded_date', { ascending: false })
    .limit(limit);

  if (name) {
    query = query.ilike('item_name', `%${name.trim()}%`);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ prices: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    item_name,
    category,
    price,
    unit,
    unit_price,
    vendor_contact_id,
    vendor_name,
    recorded_date,
    source = 'manual',
  } = body;

  if (!item_name || price == null) {
    return NextResponse.json({ error: 'item_name and price are required' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await serviceClient
    .from('item_prices')
    .upsert(
      {
        user_id: user.id,
        item_name: item_name.trim(),
        category,
        price: Math.abs(parseFloat(price)),
        unit,
        unit_price: unit_price ? Math.abs(parseFloat(unit_price)) : null,
        vendor_contact_id: vendor_contact_id || null,
        vendor_name: vendor_name || null,
        recorded_date: recorded_date || new Date().toISOString().slice(0, 10),
        source,
      },
      {
        onConflict: 'user_id,normalized_name,COALESCE(vendor_contact_id,\'00000000-0000-0000-0000-000000000000\'::uuid),recorded_date',
        ignoreDuplicates: false,
      },
    )
    .select()
    .single();

  if (error) {
    // Fallback to insert if upsert conflict resolution fails
    const { data: inserted, error: insertErr } = await serviceClient
      .from('item_prices')
      .insert({
        user_id: user.id,
        item_name: item_name.trim(),
        category,
        price: Math.abs(parseFloat(price)),
        unit,
        unit_price: unit_price ? Math.abs(parseFloat(unit_price)) : null,
        vendor_contact_id: vendor_contact_id || null,
        vendor_name: vendor_name || null,
        recorded_date: recorded_date || new Date().toISOString().slice(0, 10),
        source,
      })
      .select()
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ price: inserted }, { status: 201 });
  }

  return NextResponse.json({ price: data }, { status: 201 });
}
