// app/api/profiles/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/profiles
 * Returns the current user's profile, or null if not set up yet.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[Profiles API] GET failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/profiles
 * Create a new profile (username setup on first blog visit).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const usernameRegex = /^[a-z0-9_-]{3,30}$/;
  if (!usernameRegex.test(body.username)) {
    return NextResponse.json({
      error: 'Username must be 3–30 characters and contain only lowercase letters, numbers, hyphens, or underscores',
    }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert([{
      id: user.id,
      username: body.username,
      display_name: body.display_name || null,
      bio: body.bio || null,
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }
    console.error('[Profiles API] POST failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/**
 * PATCH /api/profiles
 * Update the current user's profile.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, string | null> = {};

  if (body.display_name !== undefined) updates.display_name = body.display_name || null;
  if (body.bio !== undefined) updates.bio = body.bio || null;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url || null;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('[Profiles API] PATCH failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
