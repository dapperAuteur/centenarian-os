// app/api/admin/education/chats/route.ts
// Admin chat sessions — list (with search), create new

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove: (name: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

// GET — list chats, optionally search by query or filter by tag/mode
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim();
  const tag = searchParams.get('tag')?.trim();
  const mode = searchParams.get('mode')?.trim();

  let query = supabaseAdmin
    .from('admin_chats')
    .select('id, mode, title, tags, notes, created_at, updated_at')
    .eq('user_id', admin.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (mode) query = query.eq('mode', mode);
  if (tag) query = query.contains('tags', [tag]);

  const { data: chats, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If search query, also search message content and filter
  if (q) {
    const tsQuery = q.split(/\s+/).filter(Boolean).join(' & ');

    // Search chat titles/notes
    const { data: chatMatches } = await supabaseAdmin
      .from('admin_chats')
      .select('id')
      .eq('user_id', admin.id)
      .textSearch('chat_search_vector', tsQuery)
      .limit(50);

    // Search message content
    const { data: msgMatches } = await supabaseAdmin
      .from('admin_chat_messages')
      .select('chat_id')
      .textSearch('search_vector', tsQuery)
      .limit(100);

    const matchIds = new Set([
      ...(chatMatches || []).map((c) => c.id),
      ...(msgMatches || []).map((m) => m.chat_id),
    ]);

    const filtered = (chats || []).filter((c) => matchIds.has(c.id));
    return NextResponse.json({ chats: filtered });
  }

  return NextResponse.json({ chats: chats || [] });
}

// POST — create a new chat session
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { mode, title } = await req.json();

  const { data, error } = await supabaseAdmin
    .from('admin_chats')
    .insert({
      user_id: admin.id,
      mode: mode || 'general',
      title: title || 'New Chat',
    })
    .select('id, mode, title, tags, notes, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chat: data }, { status: 201 });
}
