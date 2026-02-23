// app/api/wearables/route.ts
// GET: list user's wearable connections
// DELETE: disconnect a provider

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('wearable_connections')
    .select('id, provider, last_synced_at, sync_status, sync_error, created_at')
    .eq('user_id', user.id)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connections: data || [] });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const provider = request.nextUrl.searchParams.get('provider');
  if (!provider) return NextResponse.json({ error: 'Provider required' }, { status: 400 });

  const db = getDb();
  const { error } = await db
    .from('wearable_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
