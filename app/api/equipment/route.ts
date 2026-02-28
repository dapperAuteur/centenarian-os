import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const includeRetired = sp.get('include_retired') === 'true';
  const categoryId = sp.get('category_id');
  const search = sp.get('search');

  let query = supabase
    .from('equipment')
    .select('*, equipment_categories(id, name, icon, color)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!includeRetired) query = query.eq('is_active', true);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ equipment: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, category_id, brand, model, serial_number, purchase_date,
    purchase_price, current_value, warranty_expires, condition,
    image_url, image_public_id, notes, transaction_id } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('equipment')
    .insert({
      user_id: user.id,
      name: name.trim(),
      category_id: category_id || null,
      brand: brand || null,
      model: model || null,
      serial_number: serial_number || null,
      purchase_date: purchase_date || null,
      purchase_price: purchase_price ?? null,
      current_value: current_value ?? purchase_price ?? null,
      warranty_expires: warranty_expires || null,
      condition: condition || null,
      image_url: image_url || null,
      image_public_id: image_public_id || null,
      notes: notes || null,
      transaction_id: transaction_id || null,
    })
    .select('*, equipment_categories(id, name, icon, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
