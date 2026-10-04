// app/api/life-categories/tag/route.ts
// POST: tag one of the caller's own records with one of the caller's own life categories.
//
// The tag table's RLS policy only checks user_id, so without the two checks
// below a caller could tag any id: another user's transaction, say, whose
// amount /api/life-categories/analytics would then add to the caller's totals.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEntityRule } from '@/lib/activity-links/ownership';
import { checkOwned } from '@/lib/auth/ownership';

const VALID_TYPES = new Set([
  'task','trip','route','transaction','recipe',
  'fuel_log','maintenance','invoice','workout','equipment','focus_session',
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { entity_type, entity_id, life_category_id } = await request.json();

  if (!entity_type || !entity_id || !life_category_id) {
    return NextResponse.json({ error: 'entity_type, entity_id, and life_category_id are required' }, { status: 400 });
  }
  const rule = VALID_TYPES.has(entity_type) ? getEntityRule(entity_type) : null;
  if (!rule) {
    return NextResponse.json({ error: `Invalid entity_type: ${entity_type}` }, { status: 400 });
  }

  // Both ends must be the caller's own: the life category, and the record being
  // tagged (owner-only, even for types that can be public). "Not yours" and
  // "does not exist" get the same 404, so the answer never confirms an id.
  const [category, entity] = await Promise.all([
    checkOwned(supabase, user.id, 'life_categories', life_category_id),
    checkOwned(supabase, user.id, rule.table, entity_id),
  ]);
  if (category.failed || entity.failed) {
    return NextResponse.json({ error: 'Could not tag this item' }, { status: 500 });
  }
  if (!category.allowed || !entity.allowed) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('entity_life_categories')
    .insert({
      user_id: user.id,
      life_category_id,
      entity_type,
      entity_id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already tagged' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
