// app/api/equipment/export/route.ts
// GET: export equipment as CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const categoryId = params.get('category_id');

  let query = supabase
    .from('equipment')
    .select('*, equipment_categories(name)')
    .order('name', { ascending: true });

  if (categoryId) query = query.eq('category_id', categoryId);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r) => {
    const cat = r.equipment_categories as { name: string } | null;
    return [
      r.name || '',
      cat?.name || '',
      r.brand || '',
      r.model || '',
      r.serial_number || '',
      r.purchase_date || '',
      String(r.purchase_price ?? ''),
      String(r.current_value ?? ''),
      r.warranty_expires || '',
      r.condition || '',
      r.notes || '',
      r.ownership_type === 'access' ? 'access' : 'own',
    ];
  });

  return buildCsvResponse(
    ['Name', 'Category', 'Brand', 'Model', 'Serial Number', 'Purchase Date', 'Purchase Price', 'Current Value', 'Warranty Expires', 'Condition', 'Notes', 'Ownership'],
    rows,
    'centenarianos-equipment-export.csv',
  );
}
