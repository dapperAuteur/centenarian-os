import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entityType = request.nextUrl.searchParams.get('entity_type');
  const entityId = request.nextUrl.searchParams.get('entity_id');

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('entity_life_categories')
    .select('id, life_category_id, life_categories(id, name, icon, color)')
    .eq('user_id', user.id)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tags = (data || []).map((row) => ({
    id: row.id,
    life_category_id: row.life_category_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(row as any).life_categories,
  }));

  return NextResponse.json({ tags });
}
