import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { app } = await req.json().catch(() => ({ app: undefined }));

  let query = supabase
    .from('module_tours')
    .update({
      status: 'available',
      current_step: 0,
      started_at: null,
      completed_at: null,
      skipped_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  if (app) query = query.eq('app', app);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
