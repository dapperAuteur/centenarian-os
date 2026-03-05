// app/api/activity-links/route.ts
// GET: list links for an entity (both directions)
// POST: create a link between two entities
// DELETE: remove a link by id

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const VALID_TYPES = new Set([
  'task', 'trip', 'route', 'transaction', 'recipe',
  'fuel_log', 'maintenance', 'invoice', 'workout', 'equipment', 'focus_session', 'exercise', 'daily_log',
]);

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Resolve a display name for a linked entity
async function resolveDisplayName(
  db: ReturnType<typeof getDb>,
  entityType: string,
  entityId: string,
): Promise<string> {
  switch (entityType) {
    case 'task': {
      const { data } = await db.from('tasks').select('activity').eq('id', entityId).maybeSingle();
      return data?.activity || 'Task';
    }
    case 'trip': {
      const { data } = await db.from('trips').select('mode, origin, destination, date').eq('id', entityId).maybeSingle();
      if (!data) return 'Trip';
      const route = data.origin && data.destination ? `${data.origin} → ${data.destination}` : '';
      return `${data.mode}${route ? ': ' + route : ''} (${data.date})`;
    }
    case 'route': {
      const { data } = await db.from('trip_routes').select('name, date').eq('id', entityId).maybeSingle();
      return data?.name || `Route (${data?.date || '?'})`;
    }
    case 'transaction': {
      const { data } = await db.from('financial_transactions').select('vendor, amount, type').eq('id', entityId).maybeSingle();
      if (!data) return 'Transaction';
      const sign = data.type === 'expense' ? '-' : '+';
      return `${data.vendor || 'Transaction'} ${sign}$${Number(data.amount).toFixed(2)}`;
    }
    case 'recipe': {
      const { data } = await db.from('recipes').select('title').eq('id', entityId).maybeSingle();
      return data?.title || 'Recipe';
    }
    case 'fuel_log': {
      const { data } = await db.from('fuel_logs').select('station, date, total_cost').eq('id', entityId).maybeSingle();
      return data?.station ? `${data.station} (${data.date})` : `Fuel (${data?.date || '?'})`;
    }
    case 'maintenance': {
      const { data } = await db.from('vehicle_maintenance').select('service_type, date').eq('id', entityId).maybeSingle();
      return data?.service_type ? `${data.service_type} (${data.date})` : `Maintenance`;
    }
    case 'invoice': {
      const { data } = await db.from('invoices').select('contact_name, total').eq('id', entityId).maybeSingle();
      return data?.contact_name ? `Invoice: ${data.contact_name}` : 'Invoice';
    }
    case 'workout': {
      const { data } = await db.from('workout_logs').select('name, date').eq('id', entityId).maybeSingle();
      return data?.name ? `${data.name} (${data.date || '?'})` : 'Workout';
    }
    case 'equipment': {
      const { data } = await db.from('equipment').select('name, equipment_categories(name)').eq('id', entityId).maybeSingle();
      if (!data) return 'Equipment';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cat = data.equipment_categories as any;
      const catName = cat?.name as string | undefined;
      return catName ? `${data.name} (${catName})` : data.name;
    }
    case 'exercise': {
      const { data } = await db.from('exercises').select('name, exercise_categories(name)').eq('id', entityId).maybeSingle();
      if (!data) return 'Exercise';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cat = data.exercise_categories as any;
      const catName = cat?.name as string | undefined;
      return catName ? `${data.name} (${catName})` : data.name;
    }
    case 'focus_session': {
      const { data } = await db.from('focus_sessions').select('start_time, duration, session_type').eq('id', entityId).maybeSingle();
      if (!data) return 'Focus Session';
      const mins = data.duration ? Math.round(data.duration / 60) : 0;
      const dateStr = data.start_time ? new Date(data.start_time).toLocaleDateString() : '?';
      const label = data.session_type === 'work' ? 'Work' : 'Focus';
      return `${label}: ${mins}min (${dateStr})`;
    }
    case 'daily_log': {
      const { data } = await db.from('daily_logs').select('date, energy_rating').eq('id', entityId).maybeSingle();
      if (!data) return 'Daily Log';
      return `Daily Log (${data.date})${data.energy_rating ? ` — energy ${data.energy_rating}/5` : ''}`;
    }
    default:
      return entityType;
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const entityType = params.get('entity_type');
  const entityId = params.get('entity_id');

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entity_type and entity_id required' }, { status: 400 });
  }

  const db = getDb();

  // Query both directions: entity as source OR entity as target
  const [asSource, asTarget] = await Promise.all([
    db
      .from('activity_links')
      .select('*')
      .eq('user_id', user.id)
      .eq('source_type', entityType)
      .eq('source_id', entityId),
    db
      .from('activity_links')
      .select('*')
      .eq('user_id', user.id)
      .eq('target_type', entityType)
      .eq('target_id', entityId),
  ]);

  const links = [...(asSource.data ?? []), ...(asTarget.data ?? [])];

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = links.filter((l) => {
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });

  // Resolve display names for the "other" end of each link
  const resolved = await Promise.all(
    unique.map(async (link) => {
      const isSource = link.source_type === entityType && link.source_id === entityId;
      const otherType = isSource ? link.target_type : link.source_type;
      const otherId = isSource ? link.target_id : link.source_id;
      const displayName = await resolveDisplayName(db, otherType, otherId);
      return {
        ...link,
        linked_type: otherType,
        linked_id: otherId,
        linked_display_name: displayName,
      };
    }),
  );

  return NextResponse.json(resolved);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { source_type, source_id, target_type, target_id, relationship, notes } = body;

  if (!source_type || !source_id || !target_type || !target_id) {
    return NextResponse.json({ error: 'source_type, source_id, target_type, target_id required' }, { status: 400 });
  }
  if (!VALID_TYPES.has(source_type) || !VALID_TYPES.has(target_type)) {
    return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('activity_links')
    .insert({
      user_id: user.id,
      source_type,
      source_id,
      target_type,
      target_id,
      relationship: relationship?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Link already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getDb();
  const { error } = await db
    .from('activity_links')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
