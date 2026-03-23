// app/api/schedules/route.ts
// CRUD for schedule templates
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * GET /api/schedules
 * List all schedule templates for current user
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Fetch templates with finance data
  const { data: templates, error } = await db
    .from('schedule_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Schedules API] GET failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch finance rows for all templates
  const templateIds = templates.map((t: { id: string }) => t.id);
  let financeMap: Record<string, unknown> = {};
  if (templateIds.length > 0) {
    const { data: financeRows } = await db
      .from('schedule_template_finance')
      .select('*')
      .in('template_id', templateIds);
    if (financeRows) {
      financeMap = Object.fromEntries(
        financeRows.map((f: { template_id: string }) => [f.template_id, f])
      );
    }
  }

  // Fetch exception counts
  const exceptionCountMap: Record<string, number> = {};
  if (templateIds.length > 0) {
    const { data: counts } = await db
      .rpc('get_schedule_exception_counts', { template_ids: templateIds })
      .select('*');
    // Fallback: count manually if RPC doesn't exist
    if (!counts) {
      const { data: exceptions } = await db
        .from('schedule_exceptions')
        .select('template_id')
        .in('template_id', templateIds);
      if (exceptions) {
        for (const ex of exceptions) {
          exceptionCountMap[ex.template_id] = (exceptionCountMap[ex.template_id] || 0) + 1;
        }
      }
    }
  }

  const result = templates.map((t: { id: string }) => ({
    ...t,
    finance: financeMap[t.id] || null,
    exception_count: exceptionCountMap[t.id] || 0,
  }));

  return NextResponse.json(result);
}

/**
 * POST /api/schedules
 * Create a new schedule template (+ optional finance row)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { finance, ...templateFields } = body;

  if (!templateFields.name || !templateFields.template_type || !templateFields.schedule_days) {
    return NextResponse.json({
      error: 'Missing required fields: name, template_type, schedule_days',
    }, { status: 400 });
  }

  const db = getDb();

  const { data: template, error } = await db
    .from('schedule_templates')
    .insert([{
      user_id: user.id,
      name: templateFields.name,
      template_type: templateFields.template_type,
      schedule_days: templateFields.schedule_days,
      week_interval: templateFields.week_interval || 1,
      start_date: templateFields.start_date || null,
      end_date: templateFields.end_date || null,
      time_start: templateFields.time_start || null,
      time_end: templateFields.time_end || null,
      milestone_id: templateFields.milestone_id || null,
      tag: templateFields.tag || null,
      priority: templateFields.priority || 2,
      is_active: true,
    }])
    .select()
    .single();

  if (error) {
    console.error('[Schedules API] POST template failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create finance row if provided (work templates)
  let financeData = null;
  if (finance && templateFields.template_type === 'work') {
    const { data: fin, error: finError } = await db
      .from('schedule_template_finance')
      .insert([{
        template_id: template.id,
        employment_type: finance.employment_type,
        pay_rate: finance.pay_rate,
        rate_type: finance.rate_type || 'daily',
        hours_per_day: finance.hours_per_day || null,
        pay_frequency: finance.pay_frequency,
        payday_anchor: finance.payday_anchor,
        pay_account_id: finance.pay_account_id || null,
        pay_category_id: finance.pay_category_id || null,
        estimated_tax_rate: finance.estimated_tax_rate || null,
        estimated_tax_amount: finance.estimated_tax_amount || null,
        tax_tracking_method: finance.tax_tracking_method || 'none',
        per_diem_amount: finance.per_diem_amount || null,
        per_diem_category_id: finance.per_diem_category_id || null,
        travel_income_amount: finance.travel_income_amount || null,
        travel_category_id: finance.travel_category_id || null,
        deductions: finance.deductions || [],
        quarterly_tax_account_id: finance.quarterly_tax_account_id || null,
        set_aside_percentage: finance.set_aside_percentage || null,
        auto_invoice: finance.auto_invoice || false,
        invoice_template_id: finance.invoice_template_id || null,
        invoice_contact_id: finance.invoice_contact_id || null,
      }])
      .select()
      .single();

    if (finError) {
      console.error('[Schedules API] POST finance failed:', finError);
      // Template was created, return it with error note
      return NextResponse.json({ ...template, finance: null, finance_error: finError.message }, { status: 201 });
    }
    financeData = fin;
  }

  return NextResponse.json({ ...template, finance: financeData }, { status: 201 });
}

/**
 * PATCH /api/schedules
 * Update schedule template (+ optional finance)
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, finance, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const db = getDb();

  // Allowed template fields
  const allowedFields = [
    'name', 'template_type', 'schedule_days', 'week_interval',
    'start_date', 'end_date', 'time_start', 'time_end',
    'milestone_id', 'tag', 'priority', 'is_active',
  ];
  const templateUpdates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in updates) templateUpdates[key] = updates[key];
  }

  if (Object.keys(templateUpdates).length > 0) {
    const { error } = await db
      .from('schedule_templates')
      .update(templateUpdates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Schedules API] PATCH template failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Update finance if provided
  if (finance) {
    const { error: finError } = await db
      .from('schedule_template_finance')
      .upsert({
        ...finance,
        template_id: id,
      }, { onConflict: 'template_id' });

    if (finError) {
      console.error('[Schedules API] PATCH finance failed:', finError);
      return NextResponse.json({ error: finError.message }, { status: 500 });
    }
  }

  // Return updated template
  const { data: updated } = await db
    .from('schedule_templates')
    .select('*')
    .eq('id', id)
    .single();

  const { data: updatedFinance } = await db
    .from('schedule_template_finance')
    .select('*')
    .eq('template_id', id)
    .maybeSingle();

  return NextResponse.json({ ...updated, finance: updatedFinance });
}

/**
 * DELETE /api/schedules?id=xxx
 * Delete schedule template (cascades to all children)
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const db = getDb();

  const { error } = await db
    .from('schedule_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Schedules API] DELETE failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
