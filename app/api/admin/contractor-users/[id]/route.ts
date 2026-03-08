// app/api/admin/contractor-users/[id]/route.ts
// PATCH: update a user's contractor_role, products, lister fields (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const allowed = ['contractor_role', 'products', 'lister_company_name', 'lister_union_local'];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Validate contractor_role
  if (updates.contractor_role) {
    const validRoles = ['worker', 'lister', 'union_leader'];
    if (!validRoles.includes(updates.contractor_role as string)) {
      return NextResponse.json({ error: 'Invalid contractor_role' }, { status: 400 });
    }
  }

  // Validate products array
  if (updates.products) {
    const validProducts = ['centos', 'contractor', 'lister'];
    const products = updates.products as string[];
    if (!Array.isArray(products) || products.some((p) => !validProducts.includes(p))) {
      return NextResponse.json({ error: 'Invalid products array' }, { status: 400 });
    }
  }

  const db = getDb();
  const { data, error } = await db
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('id, username, email, contractor_role, products, lister_company_name, lister_union_local')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
