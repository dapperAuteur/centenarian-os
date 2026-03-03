// app/api/equipment/catalog/route.ts
// GET: returns shared equipment catalog items (readable by all authenticated users)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const search = sp.get('search')?.trim();
  const category = sp.get('category')?.trim();

  let query = supabase
    .from('equipment_catalog')
    .select('id, name, brand, model, category, description, image_url')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (search) query = query.ilike('name', `%${search}%`);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ catalog: data || [] });
}
