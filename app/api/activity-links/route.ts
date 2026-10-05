// app/api/activity-links/route.ts
// GET: list the caller's links for an entity (both directions)
// POST: create a link between two entities the caller may reference
// DELETE: remove one of the caller's links by id
//
// This route uses the service-role client. Every record it reads on the
// caller's behalf goes through lib/activity-links/ownership first.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  getEntityRule,
  loadReferencedRow,
  type AccessRow,
  type FetchRow,
} from '@/lib/activity-links/ownership';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Db = ReturnType<typeof getDb>;

/**
 * Row loader for lib/activity-links/ownership. The service-role client bypasses
 * RLS, so nothing read through it may reach the caller unless
 * loadReferencedRow() says they may reference the row.
 */
function rowLoader(db: Db): FetchRow {
  return async (table, columns, id) => {
    const { data, error } = await db.from(table).select(columns).eq('id', id).maybeSingle();
    return { row: (data as AccessRow | null) ?? null, failed: !!error };
  };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Name of an embedded category, whether PostgREST returned an object or an array. */
function embeddedName(value: unknown): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && typeof v === 'object' ? str((v as AccessRow).name) : '';
}

/**
 * How each linked type is shown: the columns to read, the label used when the
 * record is missing OR not the caller's to see, and how to format it.
 */
const DISPLAY: Record<string, { columns: string; fallback: string; format: (row: AccessRow) => string }> = {
  task: {
    columns: 'activity',
    fallback: 'Task',
    format: (r) => str(r.activity) || 'Task',
  },
  trip: {
    columns: 'mode, origin, destination, date',
    fallback: 'Trip',
    format: (r) => {
      const route = r.origin && r.destination ? `${r.origin} → ${r.destination}` : '';
      return `${r.mode}${route ? ': ' + route : ''} (${r.date})`;
    },
  },
  route: {
    columns: 'name, date',
    fallback: 'Route (?)',
    format: (r) => str(r.name) || `Route (${r.date || '?'})`,
  },
  transaction: {
    columns: 'vendor, amount, type',
    fallback: 'Transaction',
    format: (r) => {
      const sign = r.type === 'expense' ? '-' : '+';
      return `${r.vendor || 'Transaction'} ${sign}$${Number(r.amount).toFixed(2)}`;
    },
  },
  recipe: {
    columns: 'title',
    fallback: 'Recipe',
    format: (r) => str(r.title) || 'Recipe',
  },
  fuel_log: {
    columns: 'station, date, total_cost',
    fallback: 'Fuel (?)',
    format: (r) => (r.station ? `${r.station} (${r.date})` : `Fuel (${r.date || '?'})`),
  },
  maintenance: {
    columns: 'service_type, date',
    fallback: 'Maintenance',
    format: (r) => (r.service_type ? `${r.service_type} (${r.date})` : 'Maintenance'),
  },
  invoice: {
    columns: 'contact_name, total',
    fallback: 'Invoice',
    format: (r) => (r.contact_name ? `Invoice: ${r.contact_name}` : 'Invoice'),
  },
  workout: {
    columns: 'name, date',
    fallback: 'Workout',
    format: (r) => (r.name ? `${r.name} (${r.date || '?'})` : 'Workout'),
  },
  equipment: {
    columns: 'name, equipment_categories(name)',
    fallback: 'Equipment',
    format: (r) => {
      const catName = embeddedName(r.equipment_categories);
      return catName ? `${r.name} (${catName})` : str(r.name);
    },
  },
  exercise: {
    columns: 'name, exercise_categories(name)',
    fallback: 'Exercise',
    format: (r) => {
      const catName = embeddedName(r.exercise_categories);
      return catName ? `${r.name} (${catName})` : str(r.name);
    },
  },
  focus_session: {
    columns: 'start_time, duration, session_type',
    fallback: 'Focus Session',
    format: (r) => {
      const mins = r.duration ? Math.round(Number(r.duration) / 60) : 0;
      const dateStr = r.start_time ? new Date(str(r.start_time)).toLocaleDateString() : '?';
      const label = r.session_type === 'work' ? 'Work' : 'Focus';
      return `${label}: ${mins}min (${dateStr})`;
    },
  },
  daily_log: {
    columns: 'date, energy_rating',
    fallback: 'Daily Log',
    format: (r) => `Daily Log (${r.date})${r.energy_rating ? ` — energy ${r.energy_rating}/5` : ''}`,
  },
  media_item: {
    columns: 'title, media_type, creator',
    fallback: 'Media',
    format: (r) => {
      const typeLabel = str(r.media_type).replace('_', ' ');
      return r.creator ? `${r.title} — ${r.creator} (${typeLabel})` : `${r.title} (${typeLabel})`;
    },
  },
  podcast_episode: {
    columns: 'title, episode_number, season_number',
    fallback: 'Episode',
    format: (r) => {
      const ep = r.episode_number ? `S${r.season_number || 1}E${r.episode_number}` : '';
      return ep ? `${r.title} (${ep})` : str(r.title);
    },
  },
  blog_post: {
    columns: 'title',
    fallback: 'Blog Post',
    format: (r) => str(r.title) || 'Blog Post',
  },
};

/**
 * Display name for the other end of a link. The record is only read out when
 * the caller may reference it (their own, or public under its type's rule). A
 * link that points at someone else's private record gets the same bare label
 * as a record that no longer exists: no name, no detail.
 */
async function resolveDisplayName(
  fetchRow: FetchRow,
  entityType: string,
  entityId: string,
  callerId: string,
): Promise<string> {
  const display = Object.prototype.hasOwnProperty.call(DISPLAY, entityType) ? DISPLAY[entityType] : null;
  if (!display) return entityType;
  const ref = await loadReferencedRow(fetchRow, entityType, entityId, callerId, display.columns);
  if (!ref.allowed || !ref.row) return display.fallback;
  return display.format(ref.row);
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
  const fetchRow = rowLoader(db);

  // Query both directions: entity as source OR entity as target.
  // Both are scoped to the caller's own links.
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
      const displayName = await resolveDisplayName(fetchRow, otherType, otherId, user.id);
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
  // A type with no ownership rule is refused outright.
  if (!getEntityRule(source_type) || !getEntityRule(target_type)) {
    return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
  }

  const db = getDb();

  // The caller must be allowed to reference BOTH ends: their own record, or one
  // that is public under its type's rule. "Not yours" and "does not exist" get
  // the same 404, so the response never confirms that an id exists.
  const fetchRow = rowLoader(db);
  const [source, target] = await Promise.all([
    loadReferencedRow(fetchRow, source_type, source_id, user.id),
    loadReferencedRow(fetchRow, target_type, target_id, user.id),
  ]);
  if (source.failed || target.failed) {
    return NextResponse.json({ error: 'Could not create link' }, { status: 500 });
  }
  if (!source.allowed || !target.allowed) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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
