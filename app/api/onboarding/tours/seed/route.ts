import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CONTRACTOR_TOURS, LISTER_TOURS } from '@/lib/onboarding/tour-steps';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { app } = await req.json().catch(() => ({ app: 'contractor' }));
  const tours = app === 'lister' ? LISTER_TOURS : CONTRACTOR_TOURS;

  const rows = tours.map((t) => ({
    user_id: user.id,
    module_slug: t.slug,
    app: t.app,
    status: 'available' as const,
    current_step: 0,
    total_steps: t.steps.length,
  }));

  // Upsert: skip existing rows (idempotent)
  const { error } = await supabase
    .from('module_tours')
    .upsert(rows, { onConflict: 'user_id,app,module_slug', ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, seeded: rows.length });
}
