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
    .from('equipment_media')
    .select('*')
    .eq('equipment_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ media: data || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const { data: equip } = await supabase
    .from('equipment')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!equip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();

  // Support bulk insert (array) or single item
  const items: Array<{ url: string; public_id?: string; media_type: string; title?: string }> =
    Array.isArray(body) ? body : [body];

  const validTypes = ['image', 'video', 'audio'];
  const toInsert = [];

  // Get current max sort_order
  const { data: maxRow } = await supabase
    .from('equipment_media')
    .select('sort_order')
    .eq('equipment_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextOrder = (maxRow?.sort_order ?? -1) + 1;

  for (const item of items) {
    if (!item.url) continue;
    const mediaType = validTypes.includes(item.media_type) ? item.media_type : 'image';
    toInsert.push({
      equipment_id: id,
      user_id: user.id,
      url: item.url,
      public_id: item.public_id || null,
      media_type: mediaType,
      title: item.title || null,
      sort_order: nextOrder++,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ error: 'No valid media items' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('equipment_media')
    .insert(toInsert)
    .select('*');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update equipment image_url to first media item if not set
  const { data: currentEquip } = await supabase
    .from('equipment')
    .select('image_url')
    .eq('id', id)
    .maybeSingle();
  if (!currentEquip?.image_url && data?.[0]) {
    await supabase
      .from('equipment')
      .update({ image_url: data[0].url, image_public_id: data[0].public_id })
      .eq('id', id);
  }

  return NextResponse.json({ media: data || [] }, { status: 201 });
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

  // Reorder: body = { reorder: [{ id, sort_order }] }
  if (body.reorder && Array.isArray(body.reorder)) {
    for (const item of body.reorder) {
      await supabase
        .from('equipment_media')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('equipment_id', id)
        .eq('user_id', user.id);
    }

    // Update equipment image_url to first item
    const { data: first } = await supabase
      .from('equipment_media')
      .select('url, public_id')
      .eq('equipment_id', id)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (first) {
      await supabase
        .from('equipment')
        .update({ image_url: first.url, image_public_id: first.public_id })
        .eq('id', id);
    }

    return NextResponse.json({ ok: true });
  }

  // Single media update: body = { media_id, title }
  if (body.media_id) {
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('equipment_media')
      .update(updates)
      .eq('id', body.media_id)
      .eq('equipment_id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ media: data });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { media_id } = await request.json();

  if (!media_id) {
    return NextResponse.json({ error: 'media_id required' }, { status: 400 });
  }

  // Get media item for Cloudinary cleanup
  const { data: media } = await supabase
    .from('equipment_media')
    .select('public_id, media_type, url')
    .eq('id', media_id)
    .eq('equipment_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!media) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete from Cloudinary
  if (media.public_id) {
    try {
      await deleteCloudinaryAsset(media.public_id, media.media_type);
    } catch { /* non-fatal */ }
  }

  // Delete from DB
  const { error } = await supabase
    .from('equipment_media')
    .delete()
    .eq('id', media_id)
    .eq('equipment_id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update equipment image_url to next first item (or clear)
  const { data: first } = await supabase
    .from('equipment_media')
    .select('url, public_id')
    .eq('equipment_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  await supabase
    .from('equipment')
    .update({
      image_url: first?.url || null,
      image_public_id: first?.public_id || null,
    })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}

async function deleteCloudinaryAsset(publicId: string, mediaType: string) {
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

  // Use correct resource type for Cloudinary destroy
  const resourceType = mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'video' : 'image';
  await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
    { method: 'POST', body: form },
  );
}
