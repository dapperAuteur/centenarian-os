import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params { params: Promise<{ slug: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const body = await req.json();
  const allowed = ['status', 'current_step', 'total_steps', 'app'] as const;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  // Set timestamps based on status
  if (body.status === 'in_progress' && !body.skipTimestamp) {
    updates.started_at = new Date().toISOString();
  }
  if (body.status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }
  if (body.status === 'skipped') {
    updates.skipped_at = new Date().toISOString();
  }

  const app = body.app || 'main';

  // Upsert: create if doesn't exist
  const { data: existing } = await supabase
    .from('module_tours')
    .select('id')
    .eq('user_id', user.id)
    .eq('app', app)
    .eq('module_slug', slug)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('module_tours')
      .update(updates)
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from('module_tours')
      .insert({
        user_id: user.id,
        module_slug: slug,
        app,
        ...updates,
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
