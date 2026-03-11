import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const VALID_ENTITY_TYPES = ['media_item', 'equipment'] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];

const ENTITY_TABLE_MAP: Record<EntityType, string> = {
  media_item: 'media_items',
  equipment: 'equipment',
};

function getServiceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function isValidEntityType(type: string): type is EntityType {
  return VALID_ENTITY_TYPES.includes(type as EntityType);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { entity_type, entity_id, platform } = body;

  if (!entity_type || !entity_id || !platform) {
    return NextResponse.json({ error: 'entity_type, entity_id, and platform are required' }, { status: 400 });
  }

  if (!isValidEntityType(entity_type)) {
    return NextResponse.json({ error: `Invalid entity_type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` }, { status: 400 });
  }

  const table = ENTITY_TABLE_MAP[entity_type];
  const serviceDb = getServiceDb();

  // Verify the item exists
  const { data: entity } = await serviceDb
    .from(table)
    .select('id, share_count')
    .eq('id', entity_id)
    .maybeSingle();

  if (!entity) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  // Record the share
  const { error: insertError } = await supabase
    .from('social_shares')
    .insert({
      user_id: user.id,
      entity_type,
      entity_id,
      platform,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Increment share_count on entity table
  const newCount = (entity.share_count || 0) + 1;
  await serviceDb
    .from(table)
    .update({ share_count: newCount })
    .eq('id', entity_id);

  return NextResponse.json({ share_count: newCount });
}
