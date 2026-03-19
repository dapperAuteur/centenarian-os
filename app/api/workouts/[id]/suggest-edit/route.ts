// app/api/workouts/[id]/suggest-edit/route.ts
// POST — user submits a suggested edit for a workout template.
// Creates an admin_notification of type 'workout_suggestion' for admin review.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getServiceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { suggested_name, suggested_description, suggested_changes } = body;

  if (!suggested_changes?.trim()) {
    return NextResponse.json({ error: 'suggested_changes is required' }, { status: 400 });
  }

  // Fetch the workout template to get its name (user must be able to see it)
  const { data: template } = await supabase
    .from('workout_templates')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();

  if (!template) {
    return NextResponse.json({ error: 'Workout template not found' }, { status: 404 });
  }

  const db = getServiceDb();
  const { error } = await db.from('admin_notifications').insert({
    type: 'workout_suggestion',
    user_id: user.id,
    user_email: user.email ?? null,
    entity_name: template.name,
    entity_id: id,
    entity_meta: {
      suggested_name: suggested_name?.trim() || null,
      suggested_description: suggested_description?.trim() || null,
      suggested_changes: suggested_changes.trim(),
    },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
