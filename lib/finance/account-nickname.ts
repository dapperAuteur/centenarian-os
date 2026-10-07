// lib/finance/account-nickname.ts
// The nickname of a finance account (financial_accounts.nickname, migration 218): set on
// Finance → Accounts, used in Google Calendar event titles as "@nickname" next to "@1234" (the
// last four digits). Pure helpers shared by the accounts API, the accounts page and the calendar
// sync (tests/unit/calendar-accounts.test.ts).
//
// Rules (the migration's CHECK and partial unique index say the same):
//   - trimmed, a leading "@" dropped; empty means "no nickname"
//   - starts with a letter, then letters, digits, - or _; at most 20 characters
//   - unique per user among active accounts, case-insensitive (stored as typed)

export const NICKNAME_MIGRATION = '218';
export const NICKNAME_MAX_LENGTH = 20;
export const NICKNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,19}$/;
export const NICKNAME_FORMAT_MESSAGE =
  'A nickname starts with a letter and uses up to 20 letters, digits, - or _ (for example visa).';
export const NICKNAME_MIGRATION_MESSAGE = `Account nicknames need a database update. Run migration ${NICKNAME_MIGRATION} first (supabase/migrations/218_financial_account_nickname.sql).`;

export type NicknameCheck = { ok: true; value: string | null } | { ok: false; error: string };

/** A nickname from a request body or a form: null for none, or the cleaned value. */
export function cleanNickname(value: unknown): NicknameCheck {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: NICKNAME_FORMAT_MESSAGE };
  const cleaned = value.trim().replace(/^@/, '');
  if (cleaned === '') return { ok: true, value: null };
  return NICKNAME_PATTERN.test(cleaned) ? { ok: true, value: cleaned } : { ok: false, error: NICKNAME_FORMAT_MESSAGE };
}

/** The lowercase key a nickname is matched and compared by. */
export const nicknameKey = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().replace(/^@/, '').toLowerCase() : null;

/**
 * True when `nickname` is already used by another ACTIVE account of the same user
 * (`others` are that user's accounts; `selfId` is the account being saved, if any).
 */
export function nicknameTaken(
  nickname: string,
  others: readonly { id: string; nickname?: string | null; is_active?: boolean | null }[],
  selfId?: string,
): boolean {
  const key = nicknameKey(nickname);
  return others.some((a) => a.id !== selfId && a.is_active !== false && nicknameKey(a.nickname) === key);
}

/** True for the Postgres / PostgREST error of a missing nickname column (before migration 218). */
export function isNicknameColumnMissing(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  return (code === '42703' || code === 'PGRST204' || code === 'PGRST200') && /nickname/i.test(error.message ?? '');
}

/** "Visa (@visa)"-style label part: " · @visa" or "". */
export const nicknameSuffix = (nickname: string | null | undefined): string =>
  nicknameKey(nickname) ? ` · @${nickname!.trim().replace(/^@/, '')}` : '';
