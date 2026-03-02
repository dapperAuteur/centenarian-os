import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_TYPES = new Set([
  'task','trip','route','transaction','recipe',
  'fuel_log','maintenance','invoice','workout','equipment','focus_session',
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { entity_type, entity_id, life_category_id } = await request.json();

  if (!entity_type || !entity_id || !life_category_id) {
    return NextResponse.json({ error: 'entity_type, entity_id, and life_category_id are required' }, { status: 400 });
  }
  if (!VALID_TYPES.has(entity_type)) {
    return NextResponse.json({ error: `Invalid entity_type: ${entity_type}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('entity_life_categories')
    .insert({
      user_id: user.id,
      life_category_id,
      entity_type,
      entity_id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already tagged' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
