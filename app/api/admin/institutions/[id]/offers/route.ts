// app/api/admin/institutions/[id]/offers/route.ts
// GET: list offers for an institution
// POST: create a new offer

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('institution_offers')
    .select('*')
    .eq('institution_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { title, slug, description, offer_type, details, expires_at, url } = body;

  if (!title?.trim() || !slug?.trim() || !offer_type) {
    return NextResponse.json({ error: 'Title, slug, and offer_type are required' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('institution_offers')
    .insert({
      institution_id: id,
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      description: description || null,
      offer_type,
      details: details || null,
      expires_at: expires_at || null,
      url: url || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
