/**
 * Reference sender for the WitUS Outbox signed-webhook contract.
 *
 * Copy this file into your publisher product (or import from this repo) and
 * call `sendToOutbox(...)` after your user-facing response is rendered.
 * Dependency-free apart from Node's built-in `crypto` module and the runtime
 * `fetch`.
 *
 * Three rules for callers:
 *   1. Sign the exact bytes you send. Don't re-serialize JSON between hashing
 *      and POSTing; whitespace, key order, and number formatting matter.
 *   2. Don't block the user-facing response on this. Fire-and-forget after
 *      your "thank you" page renders (for example, via Next.js `after()`).
 *   3. Log at most `source`, `platform`, `external_ref`, and the HTTP status.
 *      Never log the caption, media URLs, the secret, or the signature.
 */
import { createHmac } from "node:crypto";

export type OutboxPlatform =
  | "twitter"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "bluesky"
  | "tiktok"
  | "pinterest";

export interface OutboxSubmission {
  /** Stable idempotency key from the publisher; (source, external_ref) is unique. */
  external_ref: string;
  platform: OutboxPlatform;
  caption: string;
  /** Public https URLs, ≤5MB each. Empty array allowed. */
  media_urls: string[];
  links?: string[];
  /** ISO-8601 UTC. Receiver requires ≥ now + 5 minutes. */
  scheduled_at: string;
  /**
   * Optional per-row override of the receiver's default-profile choice.
   * When omitted, outbox falls back to the workspace default (or the
   * any-match fallback). When present, every id must exist in outbox's
   * `social_profile` cache for the resolved (publisher_backend,
   * workspace) — invalid ids return `400 unknown_profile_ids` from the
   * receiver.
   *
   * Discover available ids by visiting `/outbox/setup` on the receiver
   * (logged in as admin) — each workspace card shows the cached profiles
   * with their ids.
   */
  social_profile_ids?: string[];
  /**
   * When true (slice 30), outbox lands the row as `status=draft` instead
   * of `queued`, skips the auto-submit to the publisher, and waives the
   * 5-minute lead-time check on `scheduled_at` (drafts use a placeholder;
   * the operator picks the real time when promoting in /outbox/[id]).
   *
   * Use this for "operator-reviewed" patterns where the publisher product
   * doesn't make the final go/no-go decision — e.g. FlyWitUS flight logs
   * that BAM reviews before publishing. `social_profile_ids` validation
   * is also skipped on drafts; operator can edit profile selection during
   * review via the detail-page UI.
   */
  as_draft?: boolean;
}

export interface SendArgs {
  /** Full URL of the receiver, e.g. `https://outbox.your-domain.example/api/ingest`. */
  outboxUrl: string;
  /** Lowercase kebab slug; must match an entry in the receiver's `INGEST_SOURCES`. */
  sourceSlug: string;
  /** Same `hmac_secret` the receiver has configured for this slug. ≥32 chars. */
  hmacSecret: string;
  submission: OutboxSubmission;
}

export interface SendResult {
  ok: boolean;
  status: number;
  /** UUID assigned by the receiver on success. */
  id?: string;
  /**
   * Receiver-side row status echoed in the response body. `"queued"` means
   * the row was freshly created and the auto-submit pipeline is firing.
   * `"draft"` means the row was created with `as_draft: true` and is
   * waiting for operator review on /outbox/[id]. Any other value
   * (`"submitted"`, `"error"`, `"posted"`, `"cancelled"`, `"scheduled"`)
   * means an existing row was matched on `(source, external_ref)` —
   * the POST was idempotent. Callers can use this to distinguish
   * freshly-created vs duplicate from one HTTP round trip.
   */
  recordStatus?: string;
  /** Raw response body when `ok` is false; useful for logs. */
  detail?: string;
}

export async function sendToOutbox(args: SendArgs): Promise<SendResult> {
  const rawBody = JSON.stringify(args.submission);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", args.hmacSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const res = await fetch(args.outboxUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Witus-Source": args.sourceSlug,
      "X-Witus-Timestamp": timestamp,
      "X-Witus-Signature": `sha256=${signature}`,
    },
    body: rawBody,
  });

  const text = await res.text();
  let body: { ok?: boolean; id?: string; status?: string } = {};
  try {
    body = JSON.parse(text);
  } catch {
    /* leave empty */
  }

  if (res.ok && body.ok && body.id) {
    return {
      ok: true,
      status: res.status,
      id: body.id,
      recordStatus: body.status,
    };
  }
  return { ok: false, status: res.status, detail: text };
}
