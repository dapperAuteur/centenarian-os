// app/api/finance/learned-categories/route.ts
// Learned vendor categories, stored as default_category_id on the vendor's
// saved contact (user_contacts). No table of its own.
//
// GET  ?vendor=&type=expense|income
//      -> { vendor_key, learned_category_id }
//      The category transactions from this vendor currently get automatically.
//
// POST { vendor, type, category_id }
//      "Always categorize this vendor as ...": sets default_category_id on every
//      saved contact whose name normalizes to the same vendor key, or creates
//      the contact (same insert as POST /api/contacts) when there is none.
//      -> { contact_ids, created, past: { uncategorized_ids, other_ids } }
//      `past` lists this vendor's other transactions of the same type that are
//      not in that category yet, so the client can offer to update them through
//      POST /api/finance/transactions/bulk. Nothing past is changed here.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { contactTypeForTransaction, vendorKey } from '@/lib/finance/transaction-matching';
import { findLearnedCategory } from '@/lib/finance/learned-categories';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** PostgREST's default page size. */
const PAGE_SIZE = 1000;

/** Stop scanning past transactions after this many pages (20,000 rows). */
const MAX_PAGES = 20;

function parseType(value: unknown): 'expense' | 'income' {
  return value === 'income' ? 'income' : 'expense';
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const vendor = request.nextUrl.searchParams.get('vendor') ?? '';
  const type = parseType(request.nextUrl.searchParams.get('type'));
  const key = vendorKey(vendor);
  if (!key) return NextResponse.json({ vendor_key: '', learned_category_id: null });

  const learnedCategoryId = await findLearnedCategory(getDb(), user.id, vendor, type);
  return NextResponse.json({ vendor_key: key, learned_category_id: learnedCategoryId });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const vendor = typeof body.vendor === 'string' ? body.vendor.trim() : '';
  const type = parseType(body.type);
  const categoryId = typeof body.category_id === 'string' ? body.category_id : '';
  const key = vendorKey(vendor);

  if (!key) return NextResponse.json({ error: 'A vendor name is required' }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: 'category_id is required' }, { status: 400 });

  const db = getDb();

  const { data: category } = await db
    .from('budget_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  // Every saved contact of this type whose name normalizes to the same key,
  // so "Chipotle" and "CHIPOTLE #12" both learn the new category.
  const contactType = contactTypeForTransaction(type);
  const { data: contacts, error: contactsErr } = await db
    .from('user_contacts')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('contact_type', contactType)
    .limit(PAGE_SIZE);
  if (contactsErr) return NextResponse.json({ error: contactsErr.message }, { status: 500 });

  const matchingIds = (contacts ?? []).filter((c) => vendorKey(c.name) === key).map((c) => c.id as string);
  let created = false;

  if (matchingIds.length > 0) {
    const { error } = await db
      .from('user_contacts')
      .update({ default_category_id: categoryId })
      .in('id', matchingIds)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data: inserted, error } = await db
      .from('user_contacts')
      .insert({
        user_id: user.id,
        name: vendor,
        contact_type: contactType,
        default_category_id: categoryId,
        notes: null,
      })
      .select('id')
      .maybeSingle();
    if (inserted) {
      matchingIds.push(inserted.id);
      created = true;
    } else {
      // A contact with this exact name already exists (for example beyond the
      // first page read above, or saved a moment ago): update it instead.
      const { data: updated, error: updateErr } = await db
        .from('user_contacts')
        .update({ default_category_id: categoryId })
        .eq('user_id', user.id)
        .eq('contact_type', contactType)
        .eq('name', vendor)
        .select('id');
      if (updateErr || !updated?.length) {
        return NextResponse.json({ error: error?.message ?? updateErr?.message ?? 'Could not save the vendor' }, { status: 500 });
      }
      matchingIds.push(...updated.map((c) => c.id as string));
    }
  }

  // This vendor's past transactions of the same type not yet in the category.
  const uncategorizedIds: string[] = [];
  const otherIds: string[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data: rows, error } = await db
      .from('financial_transactions')
      .select('id, vendor, category_id')
      .eq('user_id', user.id)
      .eq('type', type)
      .not('vendor', 'is', null)
      .order('transaction_date', { ascending: false })
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) break;
    for (const row of rows ?? []) {
      if (row.category_id === categoryId || vendorKey(row.vendor) !== key) continue;
      if (row.category_id) otherIds.push(row.id);
      else uncategorizedIds.push(row.id);
    }
    if (!rows || rows.length < PAGE_SIZE) break;
  }

  return NextResponse.json({
    contact_ids: matchingIds,
    created,
    past: { uncategorized_ids: uncategorizedIds, other_ids: otherIds },
  });
}
