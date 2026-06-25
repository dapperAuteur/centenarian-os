// One-time: mark the user_feedback bug reports that triage confirmed are fixed
// as 'resolved' and post a resolution event into each conversation, so the
// submitting user sees it and can confirm or reopen.
//
// REQUIRES migration 195_feedback_resolution_tracker.sql to be applied first
// (adds user_feedback.resolution_status + feedback_replies.kind).
//
// Usage:
//   node --env-file=.env.local scripts/mark-feedback-resolved.mjs --dry
//   node --env-file=.env.local scripts/mark-feedback-resolved.mjs --commit
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const DRY = !process.argv.includes('--commit');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@centenarianos.com';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.centenarianos.com';

// feedback id -> resolution note (shown to the user in the thread)
const RESOLVED = {
  '71c1ffd0': "Fixed. Your billing page now shows your renewal date ('Renews on …'), and older accounts backfill it automatically.",
  '231ceb81': 'Fixed. The Recipe Ideas button now opens the recipe suggestions page, Scan Receipt on the finance dashboard uses the /dashboard/scan tool, and the landing-page checkmarks render correctly.',
  'c47d41e8': "Added. Teachers can now 'Preview as student' from the course editor and the courses list, which opens the course exactly as a student sees it (works on unpublished drafts too).",
  '053fdf34': 'Fixed. The promo-code form on the Teacher Dashboard now uses readable light text on the dark theme (inputs, the date picker, and a clearer error panel).',
  '866fafcc': "Fixed. The expiration-date error is now a clear message ('must be in the future'), and the date picker blocks past times so it can't error that way.",
};

async function main() {
  console.log(`\n=== mark feedback resolved (${DRY ? 'DRY RUN' : 'COMMIT'}) ===\n`);

  // Resolve the admin user id (sender of the resolution events).
  let adminId = null;
  for (let page = 1; page <= 10 && !adminId; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    adminId = data?.users?.find((u) => u.email === process.env.ADMIN_EMAIL)?.id ?? null;
    if (!data?.users?.length) break;
  }
  if (!adminId) throw new Error(`Could not find admin user for ADMIN_EMAIL=${process.env.ADMIN_EMAIL}`);
  console.log(`Admin sender id: ${adminId}\n`);

  // UUID id column doesn't support ilike, so fetch the app's feedback once and
  // prefix-match in JS.
  const { data: all } = await db.from('user_feedback').select('id, user_id, message, resolution_status').eq('app', 'centenarian');

  for (const [shortId, note] of Object.entries(RESOLVED)) {
    const fb = (all ?? []).find((r) => r.id.startsWith(shortId));
    if (!fb) { console.log(`  ${shortId}: NOT FOUND, skipping`); continue; }
    if (fb.resolution_status === 'resolved' || fb.resolution_status === 'confirmed') {
      console.log(`  ${shortId}: already ${fb.resolution_status}, skipping`); continue;
    }
    console.log(`  ${shortId}: "${fb.message.slice(0, 55)}" -> resolved`);
    if (DRY) continue;

    const { error: upErr } = await db.from('user_feedback')
      .update({ resolution_status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: adminId, is_read_by_admin: true })
      .eq('id', fb.id);
    if (upErr) throw new Error(`${shortId} update: ${upErr.message}`);
    const { error: evErr } = await db.from('feedback_replies')
      .insert({ feedback_id: fb.id, sender_id: adminId, is_admin: true, kind: 'resolved', body: note });
    if (evErr) throw new Error(`${shortId} event: ${evErr.message}`);

    // Email the submitter to confirm (same as the admin "Mark resolved" flow).
    try {
      const { data: authUser } = await db.auth.admin.getUserById(fb.user_id);
      const email = authUser?.user?.email;
      if (resend && email) {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: 'Your CentenarianOS feedback was marked resolved',
          html: `<p>Good news, we believe your report is resolved:</p>
                 <blockquote style="border-left:3px solid #16a34a;padding-left:12px;color:#374151;">${note}</blockquote>
                 <p>Please open your feedback and confirm it's fixed, or reopen it if it still isn't working.</p>
                 <p><a href="${SITE}/dashboard/feedback">Confirm or reopen →</a></p>
                 <p style="color:#9ca3af;font-size:12px;">— CentenarianOS Team</p>`,
        });
        console.log(`     emailed ${email}`);
      } else {
        console.log(`     (no email sent: ${resend ? 'user has no email' : 'RESEND_API_KEY unset'})`);
      }
    } catch (e) {
      console.log(`     email failed: ${e.message}`);
    }
  }

  console.log(DRY ? '\nRe-run with --commit to apply.\n' : '\nDone. Users can now confirm or reopen from /dashboard/feedback.\n');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
