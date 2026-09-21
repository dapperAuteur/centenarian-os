// app/api/media/[id]/relationships/route.ts
// CRUD for media item relationships (episodes, tracks, artist links, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mediaRetiredResponse } from '@/lib/media/retired';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Fetch all relationships where this item is parent or child
  const { data: asParent, error: e1 } = await supabase
    .from('media_relationships')
    .select('id, child_id, relationship_type, sort_order')
    .eq('parent_id', id)
    .eq('user_id', user.id)
    .order('sort_order');

  const { data: asChild, error: e2 } = await supabase
    .from('media_relationships')
    .select('id, parent_id, relationship_type, sort_order')
    .eq('child_id', id)
    .eq('user_id', user.id)
    .order('sort_order');

  if (e1 || e2) return NextResponse.json({ error: (e1 || e2)!.message }, { status: 500 });

  // Collect all related item IDs
  const relatedIds = new Set<string>();
  for (const r of asParent || []) relatedIds.add(r.child_id);
  for (const r of asChild || []) relatedIds.add(r.parent_id);

  // Fetch item details for all related items
  let itemMap: Record<string, { id: string; title: string; media_type: string; cover_image_url: string | null }> = {};
  if (relatedIds.size > 0) {
    const { data: items } = await supabase
      .from('media_items')
      .select('id, title, media_type, cover_image_url')
      .in('id', Array.from(relatedIds));
    if (items) {
      itemMap = Object.fromEntries(items.map((i) => [i.id, i]));
    }
  }

  // Build response grouped by relationship type
  const children = (asParent || []).map((r) => ({
    relationship_id: r.id,
    relationship_type: r.relationship_type,
    sort_order: r.sort_order,
    direction: 'child' as const,
    item: itemMap[r.child_id] || null,
  }));

  const parents = (asChild || []).map((r) => ({
    relationship_id: r.id,
    relationship_type: r.relationship_type,
    sort_order: r.sort_order,
    direction: 'parent' as const,
    item: itemMap[r.parent_id] || null,
  }));

  return NextResponse.json({ relationships: [...parents, ...children] });
}

// Media moved to Stream.WitUS: writes are retired (410 Gone). See lib/media/retired.ts.
export function POST() {
  return mediaRetiredResponse();
}

export function DELETE() {
  return mediaRetiredResponse();
}
