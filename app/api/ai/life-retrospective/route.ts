// app/api/ai/life-retrospective/route.ts
// POST: generate an AI life retrospective for an arbitrary date range.
// Aggregates tasks, finance, focus, health, workouts and feeds them to Gemini.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const GEMINI_MODEL = 'gemini-2.5-flash';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const json = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function avg(rows: Record<string, unknown>[], key: string): number | null {
  const vals = rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

function sum(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((s, r) => s + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);
}

// ── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { from, to } = body as { from?: string; to?: string };

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from and to (YYYY-MM-DD) are required' }, { status: 400 });
  }

  if (from > to) {
    return NextResponse.json({ error: '"from" must be before "to"' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];
  if (from > today) {
    return NextResponse.json({ error: 'Cannot generate retrospective for a future date range' }, { status: 400 });
  }

  const db = getDb();

  // Aggregate data from 7 sources in parallel
  const [tasksRes, transRes, focusRes, healthRes, workoutRes, invoicesRes, futurePlannedRes] = await Promise.all([
    // 1. Tasks (user auth client for RLS via milestones→goals→roadmaps)
    supabase
      .from('tasks')
      .select('date, completed, priority, activity, tag, description')
      .gte('date', from)
      .lte('date', to)
      .eq('status', 'active'),

    // 2. Financial transactions
    db
      .from('financial_transactions')
      .select('date, amount, type, category_id, vendor, description, notes')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to)
      .order('date'),

    // 3. Focus sessions
    db
      .from('focus_sessions')
      .select('start_time, duration, net_work_duration, quality_rating, tags, revenue')
      .eq('user_id', user.id)
      .gte('start_time', from + 'T00:00:00')
      .lte('start_time', to + 'T23:59:59')
      .not('end_time', 'is', null),

    // 4. Health metrics
    db
      .from('user_health_metrics')
      .select('logged_date, resting_hr, steps, sleep_hours, activity_min, hrv_ms, recovery_score')
      .eq('user_id', user.id)
      .gte('logged_date', from)
      .lte('logged_date', to),

    // 5. Workout logs
    db
      .from('workout_logs')
      .select('date, name, duration_min, overall_feeling')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to),

    // 6. Invoices created in range (receivable = income intent)
    db
      .from('invoices')
      .select('invoice_date, direction, status, total, contact_name')
      .eq('user_id', user.id)
      .gte('invoice_date', from)
      .lte('invoice_date', to),

    // 7. Future-money tasks (finance tag) for planned vs actual comparison
    supabase
      .from('tasks')
      .select('date, completed, activity')
      .gte('date', from)
      .lte('date', to)
      .eq('tag', 'finance')
      .eq('status', 'active'),
  ]);

  const tasks = tasksRes.data ?? [];
  const transactions = transRes.data ?? [];
  const focus = focusRes.data ?? [];
  const health = healthRes.data ?? [];
  const workouts = workoutRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const financeTasks = futurePlannedRes.data ?? [];

  // Build summary
  const completedTasks = tasks.filter((t) => t.completed);
  const income = transactions.filter((t) => t.type === 'income');
  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalIncome = Math.round(sum(income as Record<string, unknown>[], 'amount') * 100) / 100;
  const totalExpenses = Math.round(sum(expenses as Record<string, unknown>[], 'amount') * 100) / 100;
  const focusMinutes = Math.round(
    sum(focus as Record<string, unknown>[], 'net_work_duration') / 60 ||
    sum(focus as Record<string, unknown>[], 'duration') / 60,
  );

  // Vendor spending breakdown (top 5)
  const vendorMap: Record<string, number> = {};
  for (const t of expenses) {
    const v = (t.vendor as string) || 'Unknown';
    vendorMap[v] = (vendorMap[v] || 0) + (Number(t.amount) || 0);
  }
  const topVendors = Object.entries(vendorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([vendor, total]) => ({ vendor, total: Math.round(total * 100) / 100 }));

  // Invoice analysis
  const receivableInvoices = invoices.filter((i) => i.direction === 'receivable');
  const paidInvoices = receivableInvoices.filter((i) => i.status === 'paid');
  const draftInvoices = receivableInvoices.filter((i) => i.status === 'draft');

  // Finance task completion (planned income activities)
  const completedFinanceTasks = financeTasks.filter((t) => t.completed);

  const summary = {
    period: { from, to, days: Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1 },
    tasks: {
      total: tasks.length,
      completed: completedTasks.length,
      completion_rate: tasks.length > 0
        ? Math.round((completedTasks.length / tasks.length) * 100)
        : null,
      by_tag: Object.entries(
        tasks.reduce((acc, t) => {
          const tag = (t.tag as string) || 'untagged';
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      ).map(([tag, count]) => ({ tag, count })),
    },
    finance: {
      total_income: totalIncome,
      total_expenses: totalExpenses,
      net: Math.round((totalIncome - totalExpenses) * 100) / 100,
      income_transactions: income.length,
      expense_transactions: expenses.length,
      top_expense_vendors: topVendors,
    },
    invoices: {
      receivable_created: receivableInvoices.length,
      paid: paidInvoices.length,
      still_draft: draftInvoices.length,
      total_invoiced: Math.round(sum(receivableInvoices as Record<string, unknown>[], 'total') * 100) / 100,
      total_paid: Math.round(sum(paidInvoices as Record<string, unknown>[], 'total') * 100) / 100,
    },
    income_activities: {
      planned: financeTasks.length,
      completed: completedFinanceTasks.length,
      completion_rate: financeTasks.length > 0
        ? Math.round((completedFinanceTasks.length / financeTasks.length) * 100)
        : null,
    },
    focus: {
      total_sessions: focus.length,
      total_minutes: focusMinutes,
      avg_quality: avg(focus as Record<string, unknown>[], 'quality_rating'),
      total_revenue: Math.round(sum(focus as Record<string, unknown>[], 'revenue') * 100) / 100,
    },
    health: {
      days_logged: health.length,
      avg_steps: avg(health as Record<string, unknown>[], 'steps'),
      avg_sleep_hours: avg(health as Record<string, unknown>[], 'sleep_hours'),
      avg_resting_hr: avg(health as Record<string, unknown>[], 'resting_hr'),
      avg_recovery_score: avg(health as Record<string, unknown>[], 'recovery_score'),
      avg_hrv_ms: avg(health as Record<string, unknown>[], 'hrv_ms'),
    },
    workouts: {
      total: workouts.length,
      total_minutes: sum(workouts as Record<string, unknown>[], 'duration_min'),
      avg_feeling: avg(workouts as Record<string, unknown>[], 'overall_feeling'),
    },
  };

  const prompt = `You are a longevity and performance coach on CentenarianOS.
Analyze the following aggregated data for the period ${from} to ${to} (${summary.period.days} days).
Write a clear, honest, actionable retrospective (400–600 words).

Structure your response in these sections:
1. Performance Overview — task completion rate, focus hours, overall productivity signal
2. Financial Picture — income vs expenses, net position, top spending areas, invoices sent vs paid, income-generating activities planned vs completed
3. Health & Recovery — sleep, steps, resting HR, HRV, workouts logged
4. What Went Well — 2–3 specific wins from the data
5. What Could Have Been Better — 2–3 honest gaps or missed opportunities (reference specific numbers)
6. Top 3 Recommendations for the Next Similar Period — concrete, actionable, based on the patterns you see

Here is the aggregated data:
${JSON.stringify(summary, null, 2)}

Guidelines:
- Reference specific numbers (e.g. "$X income", "X% task completion", "X focus hours")
- For finance: if income-generating activities were planned but not completed, call that out directly
- If invoices were created but remain as drafts (not sent/paid), flag this as an action item
- Be direct and honest — this is a private retrospective for self-improvement
- Use plain text with line breaks between sections, no markdown headers or bullets
- End with a one-sentence rallying call for the next period`;

  try {
    const content = await callGemini(prompt);

    if (!content.trim()) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });
    }

    return NextResponse.json({ content: content.trim(), summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate retrospective: ${message}` }, { status: 502 });
  }
}
