/**
 * Reference sender for the WitUS Inbox signed-webhook contract.
 *
 * Copied verbatim from `claude/witus-inbox/examples/sender.ts`. Call
 * `sendToInbox(...)` AFTER the user-facing response is sent (fire-and-forget
 * via Next.js `after()`); never block the user on it.
 *
 * Three rules for callers:
 *   1. Sign the exact bytes you send (don't re-serialize between hash and POST).
 *   2. Don't block the user-facing response on this.
 *   3. Log at most `source`, `form_type`, and HTTP status — never body/secret/signature.
 *
 * This is the INBOX sender (inbound user submissions → BAM's triage queue),
 * separate from `lib/sender-outbox.ts` (outbound social posts).
 */
import { createHmac } from 'node:crypto'

export interface InboxSubmission {
  form_type: string
  submitter_email?: string
  submitter_name?: string
  priority?: 'normal' | 'high'
  payload: Record<string, unknown>
}

export interface SendArgs {
  /** Full URL of the receiver, e.g. `https://inbox.witus.online/api/ingest`. */
  inboxUrl: string
  /** Lowercase kebab slug; must match an entry in the receiver's `INGEST_SOURCES`. */
  sourceSlug: string
  /** Same `hmac_secret` the receiver has configured for this slug. ≥32 chars. */
  hmacSecret: string
  submission: InboxSubmission
}

export interface SendResult {
  ok: boolean
  status: number
  id?: string
  detail?: string
}

export async function sendToInbox(args: SendArgs): Promise<SendResult> {
  const rawBody = JSON.stringify(args.submission)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = createHmac('sha256', args.hmacSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  const res = await fetch(args.inboxUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Witus-Source': args.sourceSlug,
      'X-Witus-Timestamp': timestamp,
      'X-Witus-Signature': `sha256=${signature}`,
    },
    body: rawBody,
  })

  const text = await res.text()
  let body: { ok?: boolean; id?: string } = {}
  try {
    body = JSON.parse(text)
  } catch {
    /* leave empty */
  }

  if (res.ok && body.ok && body.id) {
    return { ok: true, status: res.status, id: body.id }
  }
  return { ok: false, status: res.status, detail: text }
}
