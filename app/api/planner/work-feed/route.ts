// app/api/planner/work-feed/route.ts
// GET: returns the user's upcoming contractor jobs, outstanding invoices,
// and expected payments for display in the CentOS planner.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getExpectedIncome, type ExpectedPaymentRow } from '@/lib/finance/income-source';
import { getWorkSchedule } from '@/lib/planner/work-schedule-source';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = request.nextUrl;
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to query params are required' }, { status: 400 });
  }

  const db = getDb();

  // Fetch all data sources in parallel.
  // Job queries are wrapped in try/catch for graceful fallback when
  // contractor_jobs table doesn't exist (user only uses CentOS).
  // Jobs come from the local work_schedule_events projection (falling back to the contractor
  // tables while Phase 2b is in flight) rather than from contractor_jobs directly.
  // See lib/planner/work-schedule-source.ts.
  const scheduleRows = await getWorkSchedule(db, user.id, from, to);

  // work-feed's response splits own vs assigned, and the UI labels them differently, so the
  // split is preserved here rather than pushed into the projection's shape.
  const ownJobs = scheduleRows
    .filter((r) => r.source === 'own')
    .map((r) => ({
      id: r.job_id,
      job_number: r.job_number,
      client_name: r.client_name,
      event_name: r.event_name,
      location_name: r.location_name,
      status: r.status,
      start_date: r.start_date,
      end_date: r.end_date,
      is_multi_day: r.is_multi_day,
      scheduled_dates: r.scheduled_dates,
      pay_rate: r.pay_rate,
      rate_type: r.rate_type,
      brand_id: r.brand_id,
      notes: r.notes,
      source: 'own',
    }));

  const assignedJobs = scheduleRows
    .filter((r) => r.source === 'assigned')
    .map((r) => ({
      id: r.job_id,
      job_number: r.job_number,
      client_name: r.client_name,
      event_name: r.event_name,
      location_name: r.location_name,
      status: r.status,
      start_date: r.start_date,
      end_date: r.end_date,
      is_multi_day: r.is_multi_day,
      scheduled_dates: r.scheduled_dates,
      pay_rate: r.pay_rate,
      rate_type: r.rate_type,
      brand_id: r.brand_id,
      notes: r.notes,
      source: 'assigned',
      // Only 'accepted' assignments are projected, so this is constant. Kept because the client
      // reads it.
      assignment_status: 'accepted',
      assigned_by_name: r.assigner_name ?? 'Unknown',
    }));

  const [invoiceResult, viewPayments, schedulePayments] = await Promise.all([
    // 3. Outstanding invoices (sent or overdue)
    (async () => {
      const { data, error } = await db
        .from('invoices')
        .select('id, invoice_number, contact_name, direction, status, total, amount_paid, due_date, job_id')
        .eq('user_id', user.id)
        .eq('direction', 'receivable')
        .in('status', ['sent', 'overdue'])
        .order('due_date', { ascending: true });
      if (error) return [];
      return data ?? [];
    })(),

    // 4. Expected income (jobs + invoices with pay dates).
    //    Reads the local income_events projection, falling back to the legacy cross-app
    //    expected_payments VIEW while Phase 2 is in flight. See lib/finance/income-source.ts.
    getExpectedIncome(db, user.id, from, to),

    // 5. Schedule-based expected payments (CentOS-only)
    (async () => {
      try {
        const { data: templates } = await db
          .from('schedule_templates')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('template_type', 'work');
        if (!templates?.length) return [];

        const templateIds = templates.map((t: { id: string }) => t.id);
        const { data: periods } = await db
          .from('schedule_pay_periods')
          .select('*')
          .in('template_id', templateIds)
          .eq('is_reconciled', false)
          .gte('period_end', from)
          .lte('period_end', to);

        return (periods ?? []).map((p: Record<string, unknown>) => {
          const tmpl = templates.find((t: { id: string }) => t.id === p.template_id);
          return {
            user_id: user.id,
            source_type: 'schedule',
            source_id: p.id as string,
            expected_date: p.period_end as string,
            label: (tmpl as { name: string })?.name ?? 'Schedule',
            reference_number: null,
            expected_amount: Number(p.estimated_net ?? p.estimated_gross ?? 0),
            status: 'pending',
            start_date: p.period_start as string,
            end_date: p.period_end as string,
            brand_id: null,
            created_at: p.period_start as string,
          };
        });
      } catch {
        return [];
      }
    })(),
  ]);

  // Merge expected income (projection or legacy view) + CentOS-only schedule pay periods.
  // Both sides already share the ExpectedPaymentRow shape, so no normalization is needed.
  const expected_payments: ExpectedPaymentRow[] = [...viewPayments, ...schedulePayments];
  expected_payments.sort((a, b) =>
    (a.expected_date ?? '').localeCompare(b.expected_date ?? '')
  );

  // Compute summary
  const outstanding_receivable_total = invoiceResult.reduce(
    (sum: number, inv: Record<string, number>) => sum + ((inv.total ?? 0) - (inv.amount_paid ?? 0)), 0
  );
  const overdue_count = invoiceResult.filter(
    (inv: Record<string, string>) => inv.status === 'overdue'
  ).length;
  const expected_payments_total = expected_payments.reduce(
    (sum, p) => sum + (Number(p.expected_amount) || 0), 0
  );

  return NextResponse.json({
    jobs: ownJobs,
    assigned_jobs: assignedJobs,
    outstanding_invoices: invoiceResult,
    expected_payments,
    summary: {
      upcoming_job_count: ownJobs.length + assignedJobs.length,
      outstanding_receivable_total: Math.round(outstanding_receivable_total * 100) / 100,
      outstanding_receivable_count: invoiceResult.length,
      overdue_count,
      expected_payments_total: Math.round(expected_payments_total * 100) / 100,
      expected_payments_count: expected_payments.length,
    },
  });
}
