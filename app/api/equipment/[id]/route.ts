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
    .from('equipment')
    .select('*, equipment_categories(id, name, icon, color)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Latest valuation
  const { data: latestVal } = await supabase
    .from('equipment_valuations')
    .select('*')
    .eq('equipment_id', id)
    .eq('user_id', user.id)
    .order('valued_at', { ascending: false })
    .limit(1);

  // Count of activity links
  const { count: linkCount } = await supabase
    .from('activity_links')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .or(
      `and(source_type.eq.equipment,source_id.eq.${id}),and(target_type.eq.equipment,target_id.eq.${id})`,
    );

  return NextResponse.json({
    item: data,
    latest_valuation: latestVal?.[0] || null,
    link_count: linkCount || 0,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Shorthand flags
  if (body.retire) body.is_active = false;
  if (body.reactivate) body.is_active = true;

  const allowed = [
    'name', 'category_id', 'brand', 'model', 'serial_number',
    'purchase_date', 'purchase_price', 'current_value', 'warranty_expires',
    'condition', 'image_url', 'image_public_id', 'notes', 'is_active',
    'transaction_id', 'catalog_id', 'ownership_type',
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (updates.name && typeof updates.name === 'string') {
    updates.name = updates.name.trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('equipment')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*, equipment_categories(id, name, icon, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Check for activity links or valuations
  const [{ count: linkCount }, { count: valCount }] = await Promise.all([
    supabase
      .from('activity_links')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or(
        `and(source_type.eq.equipment,source_id.eq.${id}),and(target_type.eq.equipment,target_id.eq.${id})`,
      ),
    supabase
      .from('equipment_valuations')
      .select('id', { count: 'exact', head: true })
      .eq('equipment_id', id)
      .eq('user_id', user.id),
  ]);

  const hasLinkedData = (linkCount ?? 0) > 0 || (valCount ?? 0) > 0;

  if (hasLinkedData) {
    // Soft-deactivate
    const { error } = await supabase
      .from('equipment')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, soft_deleted: true });
  }

  // Hard delete — clean up Cloudinary assets (legacy image + all media)
  const { data: item } = await supabase
    .from('equipment')
    .select('image_public_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (item?.image_public_id) {
    try {
      await deleteCloudinaryAsset(item.image_public_id);
    } catch { /* non-fatal */ }
  }

  // Clean up all equipment_media Cloudinary assets
  const { data: allMedia } = await supabase
    .from('equipment_media')
    .select('public_id, media_type')
    .eq('equipment_id', id)
    .eq('user_id', user.id);

  if (allMedia?.length) {
    await Promise.allSettled(
      allMedia
        .filter((m) => m.public_id)
        .map((m) => deleteCloudinaryAsset(m.public_id!, m.media_type)),
    );
  }

  const { error } = await supabase
    .from('equipment')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, soft_deleted: false });
}

async function deleteCloudinaryAsset(publicId: string, mediaType?: string) {
  const { createHash } = await import('crypto');
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.round(Date.now() / 1000);
  const paramString = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(paramString + apiSecret).digest('hex');
  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });
  // Cloudinary uses 'video' resource type for both video and audio
  const resourceType = (mediaType === 'video' || mediaType === 'audio') ? 'video' : 'image';
  await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
    { method: 'POST', body: form },
  );
}
