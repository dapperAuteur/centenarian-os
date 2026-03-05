// app/api/admin/institutions/[id]/offers/[offerId]/route.ts
// PATCH: update offer
// DELETE: delete offer

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string; offerId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { offerId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const allowed = ['title', 'slug', 'description', 'offer_type', 'details', 'expires_at', 'url', 'is_published'];
  const payload = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  const db = getDb();
  const { data, error } = await db
    .from('institution_offers')
    .update(payload)
    .eq('id', offerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { offerId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const { error } = await db
    .from('institution_offers')
    .delete()
    .eq('id', offerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
