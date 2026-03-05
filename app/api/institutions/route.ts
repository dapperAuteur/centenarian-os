// app/api/institutions/route.ts
// GET: Public (no auth required) — list all institutions with optional search/sort.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get('q')?.trim();
  const sort = params.get('sort') || 'name';
  const dir = params.get('dir') === 'desc' ? false : true;

  const db = getDb();
  let query = db
    .from('institutions')
    .select('*');

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }

  const sortCol = sort === 'account_count' ? 'account_count' : 'name';
  query = query.order(sortCol, { ascending: dir });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
