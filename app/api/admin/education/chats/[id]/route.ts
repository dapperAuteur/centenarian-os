// app/api/admin/education/chats/[id]/route.ts
// Single chat session — get with messages, update (title/tags/notes), delete

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

type RouteContext = { params: Promise<{ id: string }> };

// GET — fetch chat with all messages
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;

  const { data: chat, error } = await supabaseAdmin
    .from('admin_chats')
    .select('id, mode, title, tags, notes, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', admin.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: messages } = await supabaseAdmin
    .from('admin_chat_messages')
    .select('id, role, text, created_at')
    .eq('chat_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ chat, messages: messages || [] });
}

// PATCH — update title, tags, notes
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();

  const allowed: Record<string, unknown> = {};
  if ('title' in body) allowed.title = body.title;
  if ('tags' in body) allowed.tags = body.tags;
  if ('notes' in body) allowed.notes = body.notes;
  if ('mode' in body) allowed.mode = body.mode;
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('admin_chats')
    .update(allowed)
    .eq('id', id)
    .eq('user_id', admin.id)
    .select('id, mode, title, tags, notes, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chat: data });
}

// DELETE — remove chat and all messages (cascade)
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;

  const { error } = await supabaseAdmin
    .from('admin_chats')
    .delete()
    .eq('id', id)
    .eq('user_id', admin.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
