import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const { createClient: createServerClient } = await import('@/lib/supabase/server');
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scan_image_id, transaction_id, items } = await request.json();

  if (!transaction_id) {
    return NextResponse.json({ error: 'transaction_id is required' }, { status: 400 });
  }
  if (!items?.length) {
    return NextResponse.json({ error: 'items array is required' }, { status: 400 });
  }

  const rows = items.map((item: {
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    category_hint: string | null;
    matched_item_id: string | null;
  }) => ({
    user_id: user.id,
    scan_image_id: scan_image_id || null,
    transaction_id,
    item_name: item.item_name,
    quantity: item.quantity,
    unit: 'each',
    unit_price: item.unit_price,
    total_price: item.total_price,
    category_hint: item.category_hint || null,
    matched_item_id: item.matched_item_id || null,
  }));

  const { error } = await supabaseAdmin
    .from('receipt_line_items')
    .insert(rows);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: rows.length }, { status: 201 });
}
