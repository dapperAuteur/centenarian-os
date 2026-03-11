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

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const entityType = sp.get('entity_type');
  const entityId = sp.get('entity_id');

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
  }

  if (!isValidEntityType(entityType)) {
    return NextResponse.json({ error: `Invalid entity_type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` }, { status: 400 });
  }

  const table = ENTITY_TABLE_MAP[entityType];

  // Check if user has liked this item
  const { data: like } = await supabase
    .from('social_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();

  // Get current like_count from entity table
  const serviceDb = getServiceDb();
  const { data: entity } = await serviceDb
    .from(table)
    .select('like_count')
    .eq('id', entityId)
    .maybeSingle();

  return NextResponse.json({
    liked: !!like,
    like_count: entity?.like_count || 0,
  });
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

  const { entity_type, entity_id } = body;

  if (!entity_type || !entity_id) {
    return NextResponse.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
  }

  if (!isValidEntityType(entity_type)) {
    return NextResponse.json({ error: `Invalid entity_type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` }, { status: 400 });
  }

  const table = ENTITY_TABLE_MAP[entity_type];
  const serviceDb = getServiceDb();

  // Verify the item exists and is public (or owned by user)
  const { data: entity } = await serviceDb
    .from(table)
    .select('id, user_id, visibility, like_count')
    .eq('id', entity_id)
    .maybeSingle();

  if (!entity) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  if (entity.visibility !== 'public' && entity.user_id !== user.id) {
    return NextResponse.json({ error: 'Item is not public' }, { status: 403 });
  }

  // Check if already liked
  const { data: existingLike } = await supabase
    .from('social_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .maybeSingle();

  if (existingLike) {
    // Unlike: remove the like and decrement count
    const { error: deleteError } = await supabase
      .from('social_likes')
      .delete()
      .eq('id', existingLike.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const newCount = Math.max((entity.like_count || 0) - 1, 0);
    await serviceDb
      .from(table)
      .update({ like_count: newCount })
      .eq('id', entity_id);

    return NextResponse.json({ liked: false, like_count: newCount });
  } else {
    // Like: insert the like and increment count
    const { error: insertError } = await supabase
      .from('social_likes')
      .insert({
        user_id: user.id,
        entity_type,
        entity_id,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const newCount = (entity.like_count || 0) + 1;
    await serviceDb
      .from(table)
      .update({ like_count: newCount })
      .eq('id', entity_id);

    return NextResponse.json({ liked: true, like_count: newCount });
  }
}
