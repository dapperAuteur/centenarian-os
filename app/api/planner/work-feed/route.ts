// app/api/planner/work-feed/route.ts
// GET: returns the user's upcoming contractor jobs, outstanding invoices,
// and expected payments for display in the CentOS planner.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

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
  const [ownJobs, assignedJobs, invoiceResult, viewPayments, schedulePayments] = await Promise.all([
    // 1. Own jobs
    (async () => {
      try {
        const { data, error } = await db
          .from('contractor_jobs')
          .select('id, job_number, client_name, event_name, location_name, status, start_date, end_date, is_multi_day, scheduled_dates, pay_rate, rate_type, brand_id, notes')
          .eq('user_id', user.id)
          .not('status', 'in', '("cancelled","paid")')
          .or(`start_date.gte.${from},end_date.gte.${from}`)
          .or(`start_date.lte.${to},end_date.lte.${to}`)
          .order('start_date', { ascending: true });
        if (error) return [];
        // Filter more precisely in JS for the 3-condition date overlap
        return (data ?? []).filter((j: Record<string, string | null>) => {
          const s = j.start_date ?? j.end_date;
          const e = j.end_date ?? j.start_date;
          if (!s) return false;
          return (s <= to && (e ?? s) >= from);
        }).map((j: Record<string, unknown>) => ({ ...j, source: 'own' }));
      } catch {
        return [];
      }
    })(),

    // 2. Assigned jobs (from listers)
    (async () => {
      try {
        const { data, error } = await db
          .from('contractor_job_assignments')
          .select(`
            status,
            assigned_by,
            job:contractor_jobs!inner(id, job_number, client_name, event_name, location_name, status, start_date, end_date, is_multi_day, scheduled_dates, pay_rate, rate_type, brand_id, notes),
            assigner:profiles!contractor_job_assignments_assigned_by_fkey(display_name)
          `)
          .eq('assigned_to', user.id)
          .eq('status', 'accepted');
        if (error) return [];
        return (data ?? [])
          .filter((a: Record<string, unknown>) => {
            const j = a.job as Record<string, string | null> | null;
            if (!j || j.status === 'cancelled' || j.status === 'paid') return false;
            const s = j.start_date ?? j.end_date;
            const e = j.end_date ?? j.start_date;
            if (!s) return false;
            return (s <= to && (e ?? s) >= from);
          })
          .map((a: Record<string, unknown>) => {
            const j = a.job as Record<string, unknown>;
            const assigner = a.assigner as Record<string, string> | null;
            return {
              ...j,
              source: 'assigned',
              assignment_status: a.status,
              assigned_by_name: assigner?.display_name ?? 'Unknown',
            };
          });
      } catch {
        return [];
      }
    })(),

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

    // 4. Expected payments from VIEW (jobs + invoices with pay dates)
    (async () => {
      try {
        const { data, error } = await db
          .from('expected_payments')
          .select('*')
          .eq('user_id', user.id)
          .gte('expected_date', from)
          .lte('expected_date', to)
          .order('expected_date');
        if (error) return [];
        return data ?? [];
      } catch {
        return []; // VIEW may not exist
      }
    })(),

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

  // Merge expected payments from VIEW + schedules
  const expected_payments = [...viewPayments, ...schedulePayments]
    .sort((a: Record<string, string>, b: Record<string, string>) =>
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
    (sum: number, p: Record<string, number>) => sum + (Number(p.expected_amount) || 0), 0
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
