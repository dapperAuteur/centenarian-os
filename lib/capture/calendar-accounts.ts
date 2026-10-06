// lib/capture/calendar-accounts.ts
// Which finance accounts a Google Calendar connection may record #expense / #income events
// into, and which one a given event uses. Pure: no I/O (tests/unit/calendar-accounts.test.ts).
//
// SETTINGS (calendar_connections.settings, jsonb; no migration needed)
//   allowed_account_ids  string[]         the accounts ticked in Calendar Sync
//   default_account_id   string | null    one of them: used when the title names none
// A connection saved before allowed_account_ids existed has only default_account_id: it is read
// as allowed = [default]. A default that is not in the list is treated as ticked too.
//
// NAMING AN ACCOUNT IN A TITLE
//   "@1234"   the account's last four digits (financial_accounts.last_four)
//   "@visa"   its nickname (financial_accounts.nickname, migration 218, set on Finance → Accounts;
//             lib/finance/account-nickname.ts). Before 218 there are no nicknames: last four only.
//
// PER EVENT (resolveEventAccount)
//   no "@" in the title      -> the default account (none: the transaction has no account)
//   "@1234" / "@visa"        -> the one ticked account whose last four digits or nickname match
//   matches an unticked one  -> flagged, no transaction
//   matches nothing          -> flagged, no transaction
//   matches two ticked ones  -> flagged, no transaction (give one a nickname)
// Never a guess: anything but exactly one ticked match is flagged for "Needs a look".
//
// Every account handed in as `owned` must already be checked as the user's (lib/auth/ownership.ts);
// the server side is loadCalendarAccounts in lib/capture/calendar-records.ts.
// The import keeps ".ts" because this file also runs under node --test.

import { nicknameKey } from '../finance/account-nickname.ts';

export interface CalendarAccountChoice {
  /** Ticked account ids, lowercased, in the saved order. */
  allowedIds: string[];
  /** One of allowedIds, or null. */
  defaultId: string | null;
}

/** An account the user owns: id, last four digits and nickname (null before migration 218). */
export interface OwnedAccount {
  id: string;
  last_four?: string | null;
  nickname?: string | null;
}

export type AccountResolution =
  | { ok: true; accountId: string | null }
  | { ok: false; review: string };

/** The most accounts one connection may tick. */
export const MAX_ALLOWED_ACCOUNTS = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** The last four digits of an account number as stored, or null. */
export function lastFourOf(account: Pick<OwnedAccount, 'last_four'>): string | null {
  const digits = typeof account.last_four === 'string' ? account.last_four.replace(/\D/g, '') : '';
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** Reads the account settings of one connection, old (default only) or new shape. */
export function readAccountChoice(settings: Record<string, unknown> | null | undefined): CalendarAccountChoice {
  const s = settings ?? {};
  const defaultId = isId(s.default_account_id) ? s.default_account_id.toLowerCase() : null;
  const allowedIds: string[] = [];
  if (Array.isArray(s.allowed_account_ids)) {
    for (const id of s.allowed_account_ids) {
      if (isId(id) && !allowedIds.includes(id.toLowerCase())) allowedIds.push(id.toLowerCase());
    }
  }
  // Legacy (one default, no list) and a default missing from the list: the default is ticked.
  if (defaultId && !allowedIds.includes(defaultId)) allowedIds.push(defaultId);
  return { allowedIds, defaultId };
}

/**
 * The account an event's transaction goes to. `ref` is ParsedCapture.accountRef; `owned` is every
 * account of the user (already ownership-checked), so a reference to an unticked account can be
 * told apart from a typo.
 */
export function resolveEventAccount(
  ref: string | undefined,
  choice: CalendarAccountChoice,
  owned: readonly OwnedAccount[],
): AccountResolution {
  const ownedIds = new Set(owned.map((a) => a.id.toLowerCase()));
  if (!ref) {
    return { ok: true, accountId: choice.defaultId && ownedIds.has(choice.defaultId) ? choice.defaultId : null };
  }
  const wanted = ref.toLowerCase();
  const matches = owned.filter((a) => nicknameKey(a.nickname) === wanted || lastFourOf(a) === wanted);
  const ticked = matches.filter((a) => choice.allowedIds.includes(a.id.toLowerCase()));
  if (ticked.length === 1) return { ok: true, accountId: ticked[0].id.toLowerCase() };
  if (ticked.length > 1) {
    return {
      ok: false,
      review: `@${wanted} matches more than one account ticked in Calendar Sync. Give one of them a nickname on Finance → Accounts and use it in the title.`,
    };
  }
  if (matches.length > 0) {
    return {
      ok: false,
      review: `@${wanted} is an account that is not ticked for this Google account in Calendar Sync. Tick it there, or change the title.`,
    };
  }
  return {
    ok: false,
    review: `No account matches @${wanted}. Use the last four digits or the nickname of an account ticked in Calendar Sync.`,
  };
}

/**
 * The "@" reference to write for an account (without the "@"): its nickname, else its last four
 * digits when no other ticked account shares them. Null when neither works (set a nickname).
 */
export function accountRefFor(
  accountId: string,
  choice: CalendarAccountChoice,
  owned: readonly OwnedAccount[],
): string | null {
  const id = accountId.toLowerCase();
  const account = owned.find((a) => a.id.toLowerCase() === id);
  if (!account) return null;
  const nickname = nicknameKey(account.nickname);
  if (nickname) return nickname;
  const four = lastFourOf(account);
  if (!four) return null;
  const clash = owned.some(
    (a) => a.id.toLowerCase() !== id && choice.allowedIds.includes(a.id.toLowerCase()) && lastFourOf(a) === four,
  );
  return clash ? null : four;
}

export interface AccountSettingsPatch {
  allowed_account_ids?: unknown;
  default_account_id?: unknown;
}

export type MergeResult =
  | {
      ok: true;
      settings: { allowed_account_ids: string[]; default_account_id: string | null };
      /** Every account id the request itself sent; the route checks each is the caller's. */
      sentIds: string[];
    }
  | { ok: false; error: string };

/**
 * Applies a PATCH body's account fields to the stored settings. Pure validation and merge; the
 * route then checks ownership of `sentIds` and drops stored ids the user no longer owns.
 *   allowed_account_ids  replaces the list; unticking the default clears it (never moved to a guess)
 *   default_account_id   must be null or an id; a new default is ticked too (the old one-dropdown client)
 */
export function mergeAccountSettings(current: Record<string, unknown> | null | undefined, patch: AccountSettingsPatch): MergeResult {
  const choice = readAccountChoice(current);
  const sentIds: string[] = [];
  let allowed = [...choice.allowedIds];
  let defaultId = choice.defaultId;

  if (patch.allowed_account_ids !== undefined) {
    if (!Array.isArray(patch.allowed_account_ids) || !patch.allowed_account_ids.every(isId)) {
      return { ok: false, error: 'allowed_account_ids must be a list of account ids.' };
    }
    allowed = [...new Set((patch.allowed_account_ids as string[]).map((id) => id.toLowerCase()))];
    if (allowed.length > MAX_ALLOWED_ACCOUNTS) {
      return { ok: false, error: `Tick at most ${MAX_ALLOWED_ACCOUNTS} accounts.` };
    }
    sentIds.push(...allowed);
    if (defaultId && !allowed.includes(defaultId)) defaultId = null;
  }

  if (patch.default_account_id !== undefined) {
    const value = patch.default_account_id;
    if (value !== null && !isId(value)) return { ok: false, error: 'default_account_id must be an account id or null.' };
    defaultId = value === null ? null : value.toLowerCase();
    if (defaultId) {
      sentIds.push(defaultId);
      if (!allowed.includes(defaultId)) {
        if (patch.allowed_account_ids !== undefined) {
          return { ok: false, error: 'The default account must be one of the ticked accounts.' };
        }
        allowed.push(defaultId);
      }
    }
  }

  return {
    ok: true,
    settings: { allowed_account_ids: allowed, default_account_id: defaultId },
    sentIds: [...new Set(sentIds)],
  };
}

/** The settings with every account id the user does not own removed (an account deleted since). */
export function pruneAccountSettings(
  settings: { allowed_account_ids: string[]; default_account_id: string | null },
  owns: (id: string) => boolean,
) {
  return {
    allowed_account_ids: settings.allowed_account_ids.filter(owns),
    default_account_id: settings.default_account_id && owns(settings.default_account_id) ? settings.default_account_id : null,
  };
}
