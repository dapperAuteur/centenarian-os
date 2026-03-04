// app/api/admin/invites/[id]/route.ts
// PATCH: update invite fields. DELETE: hard-delete invite.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function requireAdmin() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

const PATCHABLE = ['access_type', 'expires_at', 'is_active', 'allowed_modules', 'notes', 'demo_profile'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of PATCHABLE) {
    if (key in body) updates[key] = body[key];
  }

  const db = serviceDb();
  const { data, error } = await db
    .from('invited_users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = serviceDb();
  const { error } = await db.from('invited_users').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
