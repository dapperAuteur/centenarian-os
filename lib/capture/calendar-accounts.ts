// lib/capture/calendar-accounts.ts
// Which finance accounts a Google Calendar connection may record #expense / #income events
// into, and which one a given event uses. Pure: no I/O (tests/unit/calendar-accounts.test.ts).
//
// SETTINGS (calendar_connections.settings, jsonb; no migration needed)
//   allowed_account_ids  string[]                 the accounts ticked in Calendar Sync
//   default_account_id   string | null            one of them: used when the title names none
//   account_nicknames    { [accountId]: string }  optional short names for "@visa"
// A connection saved before allowed_account_ids existed has only default_account_id: it is read
// as allowed = [default]. A default that is not in the list is treated as ticked too.
//
// PER EVENT (resolveEventAccount)
//   no "@" in the title      -> the default account (none: the transaction has no account)
//   "@1234" / "@visa"        -> the one ticked account whose last four digits or nickname match
//   matches an unticked one  -> flagged, no transaction
//   matches nothing          -> flagged, no transaction
//   matches two ticked ones  -> flagged, no transaction (give one a nickname)
// Never a guess: anything but exactly one ticked match is flagged for "Needs a look".
//
// Every id handed in as `owned` must already be checked as the user's (lib/auth/ownership.ts);
// the server side is loadCalendarAccounts in lib/capture/calendar-records.ts.

export interface CalendarAccountChoice {
  /** Ticked account ids, lowercased, in the saved order. */
  allowedIds: string[];
  /** One of allowedIds, or null. */
  defaultId: string | null;
  /** accountId (lowercased) -> nickname (lowercased). Kept for unticked accounts too. */
  nicknames: Record<string, string>;
}

/** An account the user owns: id and last four digits. */
export interface OwnedAccount {
  id: string;
  last_four?: string | null;
}

export type AccountResolution =
  | { ok: true; accountId: string | null }
  | { ok: false; review: string };

/** The most accounts one connection may tick. */
export const MAX_ALLOWED_ACCOUNTS = 100;
/** A nickname: starts with a letter (so it never looks like last four digits), up to 20 characters. */
export const NICKNAME_PATTERN = /^[a-z][a-z0-9_-]{0,19}$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** The last four digits of an account number as stored, or null. */
export function lastFourOf(account: Pick<OwnedAccount, 'last_four'>): string | null {
  const digits = typeof account.last_four === 'string' ? account.last_four.replace(/\D/g, '') : '';
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** A nickname as typed, cleaned: "Visa " -> "visa", "@Chase" -> "chase". Null when not valid. */
export function normalizeNickname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/^@/, '').toLowerCase();
  return NICKNAME_PATTERN.test(cleaned) ? cleaned : null;
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

  const nicknames: Record<string, string> = {};
  const raw = s.account_nicknames;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      const nickname = normalizeNickname(value);
      if (isId(id) && nickname) nicknames[id.toLowerCase()] = nickname;
    }
  }
  return { allowedIds, defaultId, nicknames };
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
  const matches = owned.filter((a) => {
    const id = a.id.toLowerCase();
    return choice.nicknames[id] === wanted || lastFourOf(a) === wanted;
  });
  const ticked = matches.filter((a) => choice.allowedIds.includes(a.id.toLowerCase()));
  if (ticked.length === 1) return { ok: true, accountId: ticked[0].id.toLowerCase() };
  if (ticked.length > 1) {
    return {
      ok: false,
      review: `@${wanted} matches more than one account ticked in Calendar Sync. Give one of them a nickname there and use it in the title.`,
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
  const nickname = choice.nicknames[id];
  if (nickname) return nickname;
  const account = owned.find((a) => a.id.toLowerCase() === id);
  const four = account ? lastFourOf(account) : null;
  if (!four) return null;
  const clash = owned.some(
    (a) => a.id.toLowerCase() !== id && choice.allowedIds.includes(a.id.toLowerCase()) && lastFourOf(a) === four,
  );
  return clash ? null : four;
}

export interface AccountSettingsPatch {
  allowed_account_ids?: unknown;
  default_account_id?: unknown;
  account_nicknames?: unknown;
}

export type MergeResult =
  | {
      ok: true;
      settings: { allowed_account_ids: string[]; default_account_id: string | null; account_nicknames: Record<string, string> };
      /** Every account id the request itself sent; the route checks each is the caller's. */
      sentIds: string[];
    }
  | { ok: false; error: string };

/**
 * Applies a PATCH body's account fields to the stored settings. Pure validation and merge; the
 * route then checks ownership of `sentIds` and drops stored ids the user no longer owns.
 *   allowed_account_ids  replaces the list; unticking the default clears it (never moved to a guess)
 *   default_account_id   must be null or an id; a new default is ticked too (the old one-dropdown client)
 *   account_nicknames    merged per id; null or "" removes one; unique per connection
 */
export function mergeAccountSettings(current: Record<string, unknown> | null | undefined, patch: AccountSettingsPatch): MergeResult {
  const choice = readAccountChoice(current);
  const sentIds: string[] = [];
  let allowed = [...choice.allowedIds];
  let defaultId = choice.defaultId;
  const nicknames = { ...choice.nicknames };

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

  if (patch.account_nicknames !== undefined) {
    const raw = patch.account_nicknames;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: 'account_nicknames must be an object of account id to nickname.' };
    }
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!isId(id)) return { ok: false, error: 'account_nicknames keys must be account ids.' };
      const key = id.toLowerCase();
      if (value === null || (typeof value === 'string' && value.trim() === '')) {
        delete nicknames[key];
        continue;
      }
      const nickname = normalizeNickname(value);
      if (!nickname) {
        return {
          ok: false,
          error: 'A nickname starts with a letter and uses up to 20 letters, digits, - or _ (for example visa).',
        };
      }
      sentIds.push(key);
      nicknames[key] = nickname;
    }
    const seen = new Map<string, string>();
    for (const [id, nickname] of Object.entries(nicknames)) {
      if (seen.has(nickname) && seen.get(nickname) !== id) {
        return { ok: false, error: `The nickname "${nickname}" is already used by another account.` };
      }
      seen.set(nickname, id);
    }
  }

  return {
    ok: true,
    settings: { allowed_account_ids: allowed, default_account_id: defaultId, account_nicknames: nicknames },
    sentIds: [...new Set(sentIds)],
  };
}

/** The settings with every account id the user does not own removed (an account deleted since). */
export function pruneAccountSettings(
  settings: { allowed_account_ids: string[]; default_account_id: string | null; account_nicknames: Record<string, string> },
  owns: (id: string) => boolean,
) {
  const nicknames: Record<string, string> = {};
  for (const [id, nickname] of Object.entries(settings.account_nicknames)) if (owns(id)) nicknames[id] = nickname;
  return {
    allowed_account_ids: settings.allowed_account_ids.filter(owns),
    default_account_id: settings.default_account_id && owns(settings.default_account_id) ? settings.default_account_id : null,
    account_nicknames: nicknames,
  };
}
