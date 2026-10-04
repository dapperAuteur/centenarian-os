// app/api/travel/shares/route.ts
// GET: list shares for a trip or route
// POST: create a share (by email or public link)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * True only when the row exists AND belongs to userId. A missing row, a row
 * owned by someone else and a malformed id all come back false, so the caller
 * can answer 404 for every one of them without confirming that an id exists.
 * `failed` is a query error (answered 500, which says nothing about the id).
 */
async function ownsEntity(
  supabase: ServerClient,
  table: 'trips' | 'trip_routes',
  id: unknown,
  userId: string,
): Promise<{ owned: boolean; failed: boolean }> {
  if (typeof id !== 'string' || !UUID_RE.test(id)) return { owned: false, failed: false };
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { owned: false, failed: true };
  return { owned: !!data, failed: false };
}

type EmailLookup = { userId: string | null; failed: boolean };

// profiles has no email column — account emails live in auth.users and are only
// reachable through the service-role auth admin API (the approach the admin and
// teacher routes use). listUsers is paged, so walk the pages until a match.
async function findUserIdByEmail(
  db: ReturnType<typeof getDb>,
  email: string,
): Promise<EmailLookup> {
  const target = email.trim().toLowerCase();
  if (!target) return { userId: null, failed: false };

  const perPage = 1000;
  const maxPages = 50;
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) return { userId: null, failed: true };
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return { userId: match.id, failed: false };
    if (data.users.length < perPage) break;
  }
  return { userId: null, failed: false };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const tripId = params.get('trip_id');
  const routeId = params.get('route_id');

  let query = supabase
    .from('trip_shares')
    .select('*')
    .eq('user_id', user.id);

  if (tripId) query = query.eq('trip_id', tripId);
  if (routeId) query = query.eq('route_id', routeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The share modal reads is_public and shared_with_email, but trip_shares has
  // neither column (migration 124): a share is a public link when it carries a
  // share_token, and a per-user grant when it carries shared_with. Derive both.
  const rows = data || [];
  const recipientIds = [
    ...new Set(rows.map((s) => s.shared_with as string | null).filter((id): id is string => !!id)),
  ];
  const emailById = new Map<string, string | null>();
  if (recipientIds.length > 0) {
    const db = getDb();
    const results = await Promise.all(recipientIds.map((id) => db.auth.admin.getUserById(id)));
    recipientIds.forEach((id, i) => emailById.set(id, results[i].data?.user?.email ?? null));
  }

  const shares = rows.map((s) => ({
    ...s,
    is_public: !!s.share_token,
    shared_with_email: s.shared_with ? emailById.get(s.shared_with) ?? null : null,
  }));

  return NextResponse.json({ shares });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Accept both direct trip_id/route_id and entity_type/entity_id formats
  const trip_id = body.trip_id || (body.entity_type === 'trip' ? body.entity_id : null);
  const route_id = body.route_id || (body.entity_type === 'route' ? body.entity_id : null);
  const rawEmail = body.email || body.shared_with_email || null;
  const email = typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim() : null;
  const expires_at = body.expires_at || null;
  const included_sections = body.included_sections || null;

  if (!trip_id && !route_id) {
    return NextResponse.json({ error: 'trip_id or route_id is required' }, { status: 400 });
  }

  // Only the owner may share a trip or route. The public link endpoint reads
  // with the service role, so without this check anyone signed in could mint a
  // link to another user's trip from its id alone. Not-found and not-yours get
  // the same 404.
  for (const [table, id] of [['trips', trip_id], ['trip_routes', route_id]] as const) {
    if (!id) continue;
    const { owned, failed } = await ownsEntity(supabase, table, id, user.id);
    if (failed) return NextResponse.json({ error: 'Could not create share' }, { status: 500 });
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let shared_with: string | null = null;
  let share_token: string | null = null;

  if (email) {
    // Look up the account by email (auth.users, via the auth admin API)
    const lookup = await findUserIdByEmail(getDb(), email);
    if (lookup.failed) {
      // Don't fall through to a public link when the lookup itself broke —
      // the caller asked to share with one person, not with anyone.
      return NextResponse.json({ error: 'Could not look up that email. Please try again.' }, { status: 500 });
    }

    if (lookup.userId) {
      shared_with = lookup.userId;
    } else {
      // Email not found — generate a public share token
      share_token = randomBytes(32).toString('hex');
    }
  } else {
    // No email — generate a public link token
    share_token = randomBytes(32).toString('hex');
  }

  const { data: share, error } = await supabase
    .from('trip_shares')
    .insert({
      user_id: user.id,
      trip_id: trip_id || null,
      route_id: route_id || null,
      shared_with,
      share_token,
      expires_at: expires_at || null,
      included_sections,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update visibility to 'shared' if currently 'private'
  if (trip_id) {
    await supabase
      .from('trips')
      .update({ visibility: 'shared' })
      .eq('id', trip_id)
      .eq('user_id', user.id)
      .eq('visibility', 'private');
  }

  if (route_id) {
    await supabase
      .from('trip_routes')
      .update({ visibility: 'shared' })
      .eq('id', route_id)
      .eq('user_id', user.id)
      .eq('visibility', 'private');
  }

  return NextResponse.json({ share }, { status: 201 });
}
