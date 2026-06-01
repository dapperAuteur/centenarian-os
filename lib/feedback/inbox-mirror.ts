import { sendToInbox } from '@/lib/inbox-sender'

/**
 * Mirror an in-app feedback submission into the WitUS Inbox so BAM triages
 * every product's help/feedback/bug from one place (inbox.witus.online →
 * Triage agent). Supabase `user_feedback` stays the system of record; this is
 * a non-blocking side-channel. Never throws — a down/unconfigured Inbox must
 * not break the user's submission. Call via `after()`.
 */

// user_feedback.category → Inbox form_type (aligns with the Triage agent's
// taxonomy: bug_report / feature_request / support_question).
const FORM_TYPE_BY_CATEGORY: Record<string, string> = {
  bug: 'cent-bug-report',
  feature: 'cent-feature-request',
  general: 'cent-feedback',
}

interface MirrorArgs {
  /** user_feedback.category: 'bug' | 'feature' | 'general' */
  category: string
  /** Initial message, or the reply body for kind:'reply'. */
  message: string
  /** user_feedback row id (the feedback "thread"). */
  feedbackId: string
  kind?: 'new' | 'reply'
  submitterEmail?: string | null
}

export async function mirrorFeedbackToInbox(args: MirrorArgs): Promise<void> {
  const inboxUrl = process.env.INBOX_INGEST_URL
  const sourceSlug = process.env.INBOX_SOURCE_SLUG
  const hmacSecret = process.env.INBOX_INGEST_SECRET

  // Side-channel mirror, not the system of record. Skip silently if unconfigured.
  if (!inboxUrl || !sourceSlug || !hmacSecret) return

  const formType = FORM_TYPE_BY_CATEGORY[args.category] ?? 'cent-feedback'

  try {
    const result = await sendToInbox({
      inboxUrl,
      sourceSlug,
      hmacSecret,
      submission: {
        form_type: formType,
        priority: args.category === 'bug' ? 'high' : 'normal',
        ...(args.submitterEmail ? { submitter_email: args.submitterEmail } : {}),
        payload: {
          kind: args.kind ?? 'new',
          category: args.category,
          message: args.message,
          feedback_id: args.feedbackId,
          app: 'centenarian-os',
          url: `https://centenarianos.com/admin/feedback`,
        },
      },
    })
    if (!result.ok) {
      console.error('[inbox-mirror] failed', {
        source: sourceSlug,
        form_type: formType,
        http_status: result.status,
      })
    }
  } catch (err) {
    console.error('[inbox-mirror] error', {
      source: sourceSlug,
      form_type: formType,
      err: err instanceof Error ? err.name : 'UnknownError',
    })
  }
}
