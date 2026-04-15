import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_ENTITY_TYPES = [
  'blog_post', 'recipe', 'daily_log', 'focus_session',
  'task', 'workout_log', 'equipment', 'trip',
] as const;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entity_type');
  const entityId = searchParams.get('entity_id');

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('audio_attachments')
    .select('*')
    .eq('user_id', user.id)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('sort_order')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ attachments: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { entity_type, entity_id, audio_url, audio_public_id, label, duration_sec } = body;

  if (!entity_type || !entity_id || !audio_url) {
    return NextResponse.json({ error: 'entity_type, entity_id, and audio_url are required' }, { status: 400 });
  }

  if (!VALID_ENTITY_TYPES.includes(entity_type)) {
    return NextResponse.json({ error: `Invalid entity_type: ${entity_type}` }, { status: 400 });
  }

  // Get next sort_order
  const { data: existing } = await supabase
    .from('audio_attachments')
    .select('sort_order')
    .eq('user_id', user.id)
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('audio_attachments')
    .insert({
      user_id: user.id,
      entity_type,
      entity_id,
      audio_url,
      audio_public_id: audio_public_id || null,
      label: label || null,
      duration_sec: duration_sec || null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ attachment: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Fetch the attachment to get public_id for Cloudinary cleanup
  const { data: attachment } = await supabase
    .from('audio_attachments')
    .select('audio_public_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!attachment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete from Cloudinary (fire-and-forget)
  if (attachment.audio_public_id) {
    deleteCloudinaryAsset(attachment.audio_public_id).catch(() => {});
  }

  const { error } = await supabase
    .from('audio_attachments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

async function deleteCloudinaryAsset(publicId: string) {
  const { createHash } = await import('crypto');
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return;

  const timestamp = Math.round(Date.now() / 1000);
  const paramString = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(paramString + apiSecret).digest('hex');
  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });

  // Cloudinary uses 'video' resource type for audio files
  await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`,
    { method: 'POST', body: form },
  );
}
