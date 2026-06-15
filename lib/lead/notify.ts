// lib/lead/notify.ts
// Non-blocking notification of lead-funnel events (enrollment, teacher signup, email
// capture, download) to the WitUS Inbox, reusing the same HMAC-signed contract as the
// feedback mirror. Never throws: a down/unconfigured Inbox must not break the user
// action. Call via Next `after()` so it never blocks the response.

import { sendToInbox } from '@/lib/inbox-sender';

export type LeadFormType =
  | 'cent-enrollment'
  | 'cent-teacher-signup'
  | 'cent-lead-email'
  | 'cent-lead-download';

export async function notifyLead(
  formType: LeadFormType,
  payload: Record<string, unknown>,
  submitterEmail?: string | null,
): Promise<void> {
  const inboxUrl = process.env.INBOX_INGEST_URL;
  const sourceSlug = process.env.INBOX_SOURCE_SLUG;
  const hmacSecret = process.env.INBOX_INGEST_SECRET;
  // Side-channel only. Skip silently if the Inbox is not configured.
  if (!inboxUrl || !sourceSlug || !hmacSecret) return;

  try {
    await sendToInbox({
      inboxUrl,
      sourceSlug,
      hmacSecret,
      submission: {
        form_type: formType,
        ...(submitterEmail ? { submitter_email: submitterEmail } : {}),
        payload,
      },
    });
  } catch {
    // never throw
  }
}
