// lib/messages/visibility.ts
// Which admin messages a user may see, and so reply to.
//
// The inbox (app/api/messages/route.ts) shows a user: broadcasts to everyone
// ('all') or to their subscription status, sent after they signed up, and
// direct messages addressed to them ('user' + recipient_user_id). The replies
// route reads and writes with the service-role client, so it applies the same
// rule here before touching a thread.
//
// Pure, no '@/' imports (tests/unit/message-visibility.test.ts).

export interface AdminMessageRow {
  recipient_scope: string | null;
  recipient_user_id?: string | null;
  created_at?: string | null;
}

export interface MessageViewer {
  id: string;
  /** profiles.subscription_status, 'free' when unset. */
  status: string | null | undefined;
  /** auth.users.created_at */
  createdAt: string | null | undefined;
}

/** May this user see the admin message (and its thread)? */
export function canSeeAdminMessage(message: AdminMessageRow | null | undefined, viewer: MessageViewer): boolean {
  if (!message || !viewer.id) return false;
  const scope = message.recipient_scope;
  if (scope === 'user') return !!message.recipient_user_id && message.recipient_user_id === viewer.id;
  const status = viewer.status || 'free';
  if (scope !== 'all' && scope !== status) return false;
  // Broadcasts sent before the user signed up are not in their inbox.
  const sent = Date.parse(message.created_at ?? '');
  const joined = Date.parse(viewer.createdAt ?? '');
  if (Number.isFinite(sent) && Number.isFinite(joined) && sent < joined) return false;
  return true;
}

/**
 * A non-admin sees the admin's replies and their own, not other users'
 * replies to the same broadcast.
 */
export function visibleReply(reply: { is_admin?: boolean | null; sender_id?: string | null }, viewerId: string): boolean {
  return reply.is_admin === true || (!!viewerId && reply.sender_id === viewerId);
}

/** Escape text for an HTML email body. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
