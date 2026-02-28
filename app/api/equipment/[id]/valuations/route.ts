import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from('equipment_valuations')
    .select('*')
    .eq('equipment_id', id)
    .eq('user_id', user.id)
    .order('valued_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ valuations: data || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { valued_at, value, source, notes } = body;

  if (!valued_at || value == null) {
    return NextResponse.json({ error: 'valued_at and value are required' }, { status: 400 });
  }

  // Verify ownership of the equipment item
  const { data: item } = await supabase
    .from('equipment')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('equipment_valuations')
    .insert({
      equipment_id: id,
      user_id: user.id,
      valued_at,
      value,
      source: source || 'manual',
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update equipment.current_value to the latest valuation
  await supabase
    .from('equipment')
    .update({ current_value: value })
    .eq('id', id)
    .eq('user_id', user.id);

  return NextResponse.json({ valuation: data }, { status: 201 });
}
