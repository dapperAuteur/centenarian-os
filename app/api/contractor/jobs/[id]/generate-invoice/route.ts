// app/api/contractor/jobs/[id]/generate-invoice/route.ts
// POST: auto-generate an invoice from a time entry (or all uninvoiced entries)
// Body: { entry_id?: string } — if omitted, generates for all uninvoiced entries

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Ctx = { params: Promise<{ id: string }> };

interface TimeEntry {
  id: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  adjusted_in: string | null;
  adjusted_out: string | null;
  total_hours: number | null;
  st_hours: number | null;
  ot_hours: number | null;
  dt_hours: number | null;
  meal_provided: boolean;
  invoice_id: string | null;
}

interface Job {
  id: string;
  user_id: string;
  job_number: string;
  client_id: string | null;
  client_name: string;
  event_name: string | null;
  location_name: string | null;
  poc_name: string | null;
  crew_coordinator_name: string | null;
  pay_rate: number | null;
  ot_rate: number | null;
  dt_rate: number | null;
  benefits_eligible: boolean;
  travel_benefits: Record<string, number>;
  brand_id: string | null;
  category_id?: string | null;
  account_id?: string | null;
  est_pay_date: string | null;
  invoice_number_prefix?: string | null;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const { entry_id } = body;

  const db = getDb();

  // Fetch the job
  const { data: job, error: jobError } = await db
    .from('contractor_jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Fetch time entries to invoice
  let entryQuery = db
    .from('job_time_entries')
    .select('*')
    .eq('job_id', id)
    .eq('user_id', user.id)
    .is('invoice_id', null)
    .order('work_date', { ascending: true });

  if (entry_id) {
    entryQuery = entryQuery.eq('id', entry_id);
  }

  const { data: entries, error: entryError } = await entryQuery;
  if (entryError) return NextResponse.json({ error: entryError.message }, { status: 500 });
  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: 'No uninvoiced time entries found' }, { status: 400 });
  }

  const typedJob = job as Job;
  const invoices = [];

  // Generate one invoice per time entry (matches the CBS Sports pattern — one pay stub per work day)
  for (const entry of entries as TimeEntry[]) {
    const items = buildLineItems(typedJob, entry);
    const benefitItems = typedJob.benefits_eligible ? buildBenefitItems(typedJob, entry) : [];

    const lineItemTotal = items.reduce((sum, i) => sum + i.amount, 0);
    const subtotal = Math.round(lineItemTotal * 100) / 100;

    // Determine invoice number
    const prefix = typedJob.job_number;
    const dateStr = entry.work_date.replace(/-/g, '');
    const invoiceNumber = `${prefix}-${dateStr}`;

    const customFields: Record<string, string> = {};
    if (typedJob.poc_name) customFields.poc_name = typedJob.poc_name;
    if (typedJob.location_name) customFields.location = typedJob.location_name;
    if (typedJob.crew_coordinator_name) customFields.crew_coordinator = typedJob.crew_coordinator_name;
    customFields.job_reference = typedJob.job_number;
    customFields.work_date = entry.work_date;
    if (entry.adjusted_in || entry.time_in) {
      customFields.time_in = formatTime(entry.adjusted_in || entry.time_in);
    }
    if (entry.adjusted_out || entry.time_out) {
      customFields.time_out = formatTime(entry.adjusted_out || entry.time_out);
    }

    const { data: invoice, error: invError } = await db
      .from('invoices')
      .insert({
        user_id: user.id,
        direction: 'receivable',
        status: 'draft',
        contact_name: typedJob.client_name,
        contact_id: typedJob.client_id,
        subtotal,
        tax_amount: 0,
        total: subtotal,
        invoice_date: entry.work_date,
        due_date: typedJob.est_pay_date ?? null,
        invoice_number: invoiceNumber,
        brand_id: typedJob.brand_id ?? null,
        job_id: typedJob.id,
        custom_fields: customFields,
        notes: typedJob.event_name
          ? `${typedJob.event_name} — ${entry.work_date}`
          : `${typedJob.job_number} — ${entry.work_date}`,
      })
      .select()
      .single();

    if (invError) return NextResponse.json({ error: invError.message }, { status: 500 });

    // Insert all line items (earnings + benefits)
    const allItems = [...items, ...benefitItems].map((item, idx) => ({
      ...item,
      invoice_id: invoice.id,
      sort_order: idx,
    }));

    if (allItems.length > 0) {
      const { error: itemError } = await db.from('invoice_items').insert(allItems);
      if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    // Link time entry to invoice
    await db
      .from('job_time_entries')
      .update({ invoice_id: invoice.id })
      .eq('id', entry.id);

    invoices.push(invoice);
  }

  return NextResponse.json({ invoices, count: invoices.length }, { status: 201 });
}

function buildLineItems(job: Job, entry: TimeEntry) {
  const items: { description: string; quantity: number; unit_price: number; amount: number; item_type: string }[] = [];

  const stHours = entry.st_hours ?? entry.total_hours ?? 0;
  const otHours = entry.ot_hours ?? 0;
  const dtHours = entry.dt_hours ?? 0;

  if (stHours > 0 && job.pay_rate) {
    items.push({
      description: 'ST (Straight Time)',
      quantity: stHours,
      unit_price: job.pay_rate,
      amount: Math.round(stHours * job.pay_rate * 100) / 100,
      item_type: 'line_item',
    });
  }

  if (otHours > 0 && job.ot_rate) {
    items.push({
      description: 'OT (Overtime)',
      quantity: otHours,
      unit_price: job.ot_rate,
      amount: Math.round(otHours * job.ot_rate * 100) / 100,
      item_type: 'line_item',
    });
  }

  if (dtHours > 0 && job.dt_rate) {
    items.push({
      description: 'DT (Double Time)',
      quantity: dtHours,
      unit_price: job.dt_rate,
      amount: Math.round(dtHours * job.dt_rate * 100) / 100,
      item_type: 'line_item',
    });
  }

  // Travel benefits as line items
  const tb = job.travel_benefits ?? {};
  if (tb.meal_allowance && !entry.meal_provided) {
    items.push({
      description: 'Meal Allowance',
      quantity: 1,
      unit_price: tb.meal_allowance,
      amount: tb.meal_allowance,
      item_type: 'line_item',
    });
  }

  if (tb.per_diem) {
    items.push({
      description: 'Per Diem',
      quantity: 1,
      unit_price: tb.per_diem,
      amount: tb.per_diem,
      item_type: 'line_item',
    });
  }

  if (tb.extra_pay) {
    items.push({
      description: 'Additional Travel Pay',
      quantity: 1,
      unit_price: tb.extra_pay,
      amount: tb.extra_pay,
      item_type: 'line_item',
    });
  }

  return items;
}

function buildBenefitItems(job: Job, entry: TimeEntry) {
  // Benefits from travel_benefits.benefits array or metadata
  const benefits: { description: string; quantity: number; unit_price: number; amount: number; item_type: string }[] = [];
  const meta = (job as unknown as { metadata: { benefits?: { name: string; amount: number }[] } }).metadata;

  if (meta?.benefits && Array.isArray(meta.benefits)) {
    for (const b of meta.benefits) {
      if (b.name && b.amount) {
        benefits.push({
          description: b.name,
          quantity: 1,
          unit_price: b.amount,
          amount: b.amount,
          item_type: 'benefit',
        });
      }
    }
  }

  // If no explicit benefits but we have hours, allow Vacation pay line
  const tb = job.travel_benefits ?? {};
  if (tb.vacation_rate && entry.total_hours) {
    benefits.push({
      description: 'Vacation Pay',
      quantity: 1,
      unit_price: 0,
      amount: Math.round(Number(tb.vacation_rate) * 100) / 100,
      item_type: 'benefit',
    });
  }

  return benefits;
}

function formatTime(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
