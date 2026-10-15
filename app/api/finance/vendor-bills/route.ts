// app/api/finance/vendor-bills/route.ts
// GET: the signed-in owner's vendor bills (RLS scopes the rows), newest period first.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('vendor_bills')
    .select('id, service_slug, service_name, vendor, plan, billed_via, period_start, period_end, base_fee, usage_cost, currency, account_url, witus_url, updated_at')
    .order('period_end', { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bills: data ?? [] });
}
