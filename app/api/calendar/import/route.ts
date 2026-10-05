// app/api/calendar/import/route.ts
// POST: parse an .ics file and import events as planner tasks.
// Tasks go to a "Google Calendar: <name>" milestone in the user's own roadmap, or to the Inbox
// when they have no roadmap of their own (lib/planner/import-milestone.ts).
// For "future money" calendars, also creates draft invoices from the PPI CBS template.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { parseIcs, extractCalendarName, type CalendarEvent } from '@/lib/calendar/ics-parser';
import { resolveImportMilestone, type ImportMilestone } from '@/lib/planner/import-milestone';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_TAGS = new Set(['personal', 'work', 'health', 'finance', 'travel', 'errands', 'fitness']);

const WORK_KEYWORDS = [
  'meeting', 'call', 'client', 'project', 'presentation', 'deadline',
  'interview', 'pitch', 'proposal', 'review', 'sprint', 'launch', 'demo',
];

function detectTag(calendarName: string, event: CalendarEvent, tagOverride?: string): string {
  if (tagOverride && VALID_TAGS.has(tagOverride)) return tagOverride;

  const calLower = calendarName.toLowerCase();
  if (
    calLower.includes('money') ||
    calLower.includes('finance') ||
    calLower.includes('business') ||
    calLower.includes('invoice')
  ) return 'finance';

  const summaryLower = event.summary.toLowerCase();
  if (WORK_KEYWORDS.some((k) => summaryLower.includes(k))) return 'work';

  return 'personal';
}

function isFutureMoneyCalendar(calendarName: string): boolean {
  const lower = calendarName.toLowerCase();
  return lower.includes('future money') || (lower.includes('money') && lower.includes('future'));
}

/** Create a draft invoice from the PPI CBS template for a calendar event. */
async function createInvoiceFromTemplate(
  db: ReturnType<typeof getDb>,
  userId: string,
  templateId: string,
  event: CalendarEvent,
): Promise<void> {
  const { data: template, error } = await db
    .from('invoice_templates')
    .select('*, invoice_template_items(*)')
    .eq('id', templateId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !template) return;

  // Sort template items
  const templateItems: {
    description: string; quantity: number; unit_price: number;
    amount: number; sort_order: number; item_type?: string;
  }[] = (template.invoice_template_items ?? []).sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
  );

  // Auto-increment invoice number if prefix is set
  let invoiceNumber: string | null = null;
  if (template.invoice_number_prefix) {
    const { count } = await db
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .like('invoice_number', `${template.invoice_number_prefix}-%`);
    const nextNum = (count ?? 0) + 1;
    invoiceNumber = `${template.invoice_number_prefix}-${String(nextNum).padStart(3, '0')}`;
  }

  const { data: invoice } = await db
    .from('invoices')
    .insert({
      user_id: userId,
      direction: template.direction || 'receivable',
      status: 'draft',
      contact_name: event.summary.slice(0, 255),
      contact_id: template.contact_id ?? null,
      subtotal: template.subtotal ?? 0,
      tax_amount: template.tax_amount ?? 0,
      total: template.total ?? 0,
      amount_paid: 0,
      invoice_date: event.dtstart,
      invoice_number: invoiceNumber,
      invoice_number_prefix: template.invoice_number_prefix ?? null,
      account_id: template.account_id ?? null,
      brand_id: template.brand_id ?? null,
      category_id: template.category_id ?? null,
      notes: event.description?.slice(0, 1000) ?? null,
    })
    .select('id')
    .single();

  if (!invoice) return;

  if (templateItems.length > 0) {
    await db.from('invoice_items').insert(
      templateItems.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        sort_order: item.sort_order,
        item_type: item.item_type || 'line_item',
      })),
    );
  }

  await db
    .from('invoice_templates')
    .update({ use_count: (template.use_count ?? 0) + 1 })
    .eq('id', template.id);
}

// ── POST /api/calendar/import ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { ics_content, calendar_name, tag_override } = body as {
    ics_content?: string;
    calendar_name?: string;
    tag_override?: string;
  };

  if (!ics_content || typeof ics_content !== 'string') {
    return NextResponse.json({ error: 'ics_content is required' }, { status: 400 });
  }

  const resolvedName = calendar_name?.trim() || extractCalendarName(ics_content);
  const futureMoney = isFutureMoneyCalendar(resolvedName);

  // Parse all events, then drop the ones that can't become tasks
  const events = parseIcs(ics_content);
  const importable = events.filter(
    // Skip cancelled events and events without a parseable date
    (event) => event.status !== 'CANCELLED' && !!event.dtstart && /^\d{4}-\d{2}-\d{2}$/.test(event.dtstart),
  );
  const skipped = events.length - importable.length;

  // Checked before the milestone is resolved, so an empty file creates no milestone or Inbox.
  if (importable.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped,
      invoices_created: 0,
      message: `No valid events to import. ${skipped} skipped (cancelled or missing date).`,
    });
  }

  const db = getDb();

  // "Google Calendar: <name>" in one of the user's own roadmaps, or the Inbox when they have no
  // roadmap of their own. Never a system roadmap (lib/planner/import-milestone.ts).
  const milestoneTitle = `Google Calendar: ${resolvedName}`;
  let target: ImportMilestone;
  try {
    target = await resolveImportMilestone(db, user.id, milestoneTitle);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to resolve milestone: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 },
    );
  }

  // For future money calendar: find PPI CBS template
  let ppiTemplateId: string | null = null;
  if (futureMoney) {
    const { data: tmpl } = await db
      .from('invoice_templates')
      .select('id')
      .eq('user_id', user.id)
      .ilike('name', '%PPI%CBS%')
      .limit(1)
      .maybeSingle();
    ppiTemplateId = tmpl?.id ?? null;
  }

  const payloads: Record<string, unknown>[] = [];
  let invoicesCreated = 0;

  for (const event of importable) {
    const tag = detectTag(resolvedName, event, tag_override);
    const descParts = [event.description, event.location].filter(Boolean);
    const description = descParts.length > 0 ? descParts.join(' | ').slice(0, 1000) : null;

    payloads.push({
      // tasks has no user_id column: ownership runs milestone -> goal -> roadmap.user_id.
      // Sending user_id made every insert fail.
      milestone_id: target.milestoneId,
      date: event.dtstart,
      // tasks.time is NOT NULL. All-day events have no time; 09:00 matches the other task
      // creation paths (app/api/tasks, the CSV import).
      time: event.dtstart_time ?? '09:00',
      activity: event.summary.slice(0, 255),
      description,
      tag,
      priority: 2,
      estimated_cost: null,
      completed: event.status === 'COMPLETED',
    });

    // Create draft invoice from PPI CBS template for future money events
    if (futureMoney && ppiTemplateId) {
      try {
        await createInvoiceFromTemplate(db, user.id, ppiTemplateId, event);
        invoicesCreated++;
      } catch { /* non-fatal */ }
    }
  }

  const { data, error } = await db
    .from('tasks')
    .insert(payloads)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const imported = data?.length ?? 0;
  const invoiceNote = invoicesCreated > 0
    ? ` Created ${invoicesCreated} draft invoice${invoicesCreated !== 1 ? 's' : ''} from PPI CBS template.`
    : futureMoney && !ppiTemplateId
      ? ' (PPI CBS template not found — invoices skipped)'
      : '';
  const whereNote = target.placement === 'inbox'
    ? ' in your Inbox'
    : ` under the "${milestoneTitle}" milestone`;

  // Compute date range from imported payloads
  const dates = payloads.map(p => p.date as string).filter(Boolean).sort();
  const dateRange = dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null;

  return NextResponse.json({
    imported,
    skipped,
    invoices_created: invoicesCreated,
    milestone_id: target.milestoneId,
    calendar_name: resolvedName,
    date_range: dateRange,
    message: `Imported ${imported} event${imported !== 1 ? 's' : ''} as tasks${whereNote}.${invoiceNote}${skipped > 0 ? ` ${skipped} skipped.` : ''}`,
  });
}
