import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params { params: Promise<{ slug: string }> }

export async function POST(req: Request, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const { app = 'main' } = await req.json().catch(() => ({}));

  const { error } = await supabase
    .from('module_tours')
    .update({
      status: 'available',
      current_step: 0,
      started_at: null,
      completed_at: null,
      skipped_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('app', app)
    .eq('module_slug', slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
