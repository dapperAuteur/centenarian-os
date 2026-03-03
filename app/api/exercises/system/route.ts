// app/api/exercises/system/route.ts
// GET: browse the shared system exercise library

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const search   = sp.get('search')?.trim();
  const category = sp.get('category')?.trim();
  const equipment = sp.get('equipment_needed')?.trim();

  let query = supabase
    .from('system_exercises')
    .select('id, name, category, instructions, form_cues, primary_muscles, difficulty, equipment_needed')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name',     { ascending: true });

  if (search)    query = query.ilike('name', `%${search}%`);
  if (category)  query = query.eq('category', category);
  if (equipment) query = query.eq('equipment_needed', equipment);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ exercises: data || [] });
}
