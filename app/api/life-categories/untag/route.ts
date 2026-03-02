import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { entity_type, entity_id, life_category_id } = await request.json();

  if (!entity_type || !entity_id || !life_category_id) {
    return NextResponse.json({ error: 'entity_type, entity_id, and life_category_id are required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('entity_life_categories')
    .delete()
    .eq('user_id', user.id)
    .eq('life_category_id', life_category_id)
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
