// lib/finance/transfers/pairing.ts
// The rules for money that moves between a person's own accounts: which two
// transactions can be the two sides of one transfer, which side the money
// left, what kind of transfer it is, and how an account is named on screen.
//
// A transfer is two rows that share a `transfer_group_id`: an expense on the
// account the money left and an income on the account it reached. On a credit
// card or a loan, an income row lowers what is owed, so an income row there is
// a payment (see the balance formula in app/api/finance/accounts/route.ts).
//
// No imports on purpose. This file runs in API routes, in client components,
// and under `node --test --experimental-strip-types`
// (tests/unit/transfer-detect.test.ts).

/** What a linked pair is, decided by the account the money reached. */
export type TransferKind = 'transfer' | 'card_payment' | 'loan_payment';

export const TRANSFER_KINDS: readonly TransferKind[] = ['transfer', 'card_payment', 'loan_payment'];

export const TRANSFER_KIND_LABEL: Record<TransferKind, string> = {
  transfer: 'Transfer',
  card_payment: 'Card payment',
  loan_payment: 'Loan payment',
};

export function isTransferKind(value: unknown): value is TransferKind {
  return typeof value === 'string' && (TRANSFER_KINDS as readonly string[]).includes(value);
}

/** The account fields the transfer rules and labels need. */
export interface AccountRef {
  id: string;
  /** 'checking' | 'savings' | 'cash' | 'credit_card' | 'loan' */
  account_type: string;
  name: string;
  institution_name: string | null;
  last_four: string | null;
}

/** Money you have (checking, savings, cash) or money you owe (credit card, loan). */
export type AccountClass = 'asset' | 'debt';

export function accountClass(accountType: string | null | undefined): AccountClass {
  return accountType === 'credit_card' || accountType === 'loan' ? 'debt' : 'asset';
}

/**
 * What a row means on its account:
 * - `outflow`: an expense on an asset account (money left it).
 * - `inflow`: an income on an asset account (money reached it).
 * - `payment`: an income on a card or loan (what is owed went down).
 * - `charge`: an expense on a card or loan (what is owed went up).
 */
export type MoneyFlow = 'outflow' | 'inflow' | 'payment' | 'charge';

export function moneyFlow(type: 'expense' | 'income', accountType: string | null | undefined): MoneyFlow {
  if (accountClass(accountType) === 'debt') return type === 'income' ? 'payment' : 'charge';
  return type === 'income' ? 'inflow' : 'outflow';
}

/** A pair's kind comes from the account the money reached. */
export function kindForDestination(accountType: string | null | undefined): TransferKind {
  if (accountType === 'credit_card') return 'card_payment';
  if (accountType === 'loan') return 'loan_payment';
  return 'transfer';
}

/**
 * How an account is written wherever one has to be told apart from another:
 * institution, name, and last four. Two accounts can share a name, so the
 * name alone is never enough.
 *
 *   { institution_name: 'Navy Federal', name: 'EveryDay Checking', last_four: '1234' }
 *     -> "Navy Federal EveryDay Checking ••1234"
 *
 * The institution is left out when the name already starts with it.
 */
export function accountLabel(
  account: { name?: string | null; institution_name?: string | null; last_four?: string | null } | null | undefined,
): string {
  if (!account) return 'an account that was removed';
  const name = (account.name ?? '').trim() || 'Account';
  const institution = (account.institution_name ?? '').trim();
  const lastFour = (account.last_four ?? '').trim();
  const showInstitution = institution !== '' && !name.toLowerCase().startsWith(institution.toLowerCase());
  return [showInstitution ? institution : '', name, lastFour ? `••${lastFour}` : '']
    .filter(Boolean)
    .join(' ');
}

/** Dollars (a number, or the string a numeric column may arrive as) to whole cents. */
export function toCents(amount: number | string | null | undefined): number {
  return Math.round(Math.abs(Number(amount)) * 100);
}

/** One side of a possible pair. */
export interface PairRow {
  id: string;
  account_id: string | null;
  amountCents: number;
  type: 'expense' | 'income';
}

export type PairCheck =
  | { ok: true; fromId: string; toId: string; kind: TransferKind }
  | { ok: false; error: string };

/**
 * Decides whether two rows can be the two sides of one transfer.
 *
 * They can when both have an account, the accounts differ, the amounts are
 * equal to the cent, and one row is an expense while the other is an income.
 * The expense row is the side the money left (`fromId`); the income row is
 * the side it reached (`toId`), and that account's type gives the kind.
 *
 * `accountTypes` maps account id to account type; an id missing from it
 * counts as no account.
 */
export function checkPair(a: PairRow, b: PairRow, accountTypes: ReadonlyMap<string, string>): PairCheck {
  if (a.id === b.id) return { ok: false, error: 'Pick two different transactions.' };
  if (!a.account_id || !b.account_id || !accountTypes.has(a.account_id) || !accountTypes.has(b.account_id)) {
    return {
      ok: false,
      error: 'Both transactions need an account before they can be linked as a transfer.',
    };
  }
  if (a.account_id === b.account_id) {
    return { ok: false, error: 'Both transactions are on the same account. A transfer moves money between two accounts.' };
  }
  if (a.amountCents !== b.amountCents) {
    return { ok: false, error: 'The two amounts are different. Both sides of a transfer have the same amount.' };
  }
  if (a.type === b.type) {
    const both = a.type === 'expense' ? 'expenses' : 'income';
    return {
      ok: false,
      error:
        `Both transactions are ${both}. A transfer is an expense on the account the money left and an income on the account it reached. ` +
        'If one of them is on a credit card and has the wrong type, correct its type first.',
    };
  }
  const from = a.type === 'expense' ? a : b;
  const to = a.type === 'expense' ? b : a;
  return { ok: true, fromId: from.id, toId: to.id, kind: kindForDestination(accountTypes.get(to.account_id!)) };
}

/**
 * The reason an edit to one side of a transfer has to be refused, or null when
 * the edit is fine. The two sides must keep the same amount and opposite
 * types, so changing either on one row alone is refused. Category, notes,
 * date and the rest are not looked at.
 *
 * `changes` holds only the fields the edit sends; a field sent with its
 * current value is not a change.
 */
export function transferEditConflict(
  current: { amount: number | string; type: string },
  changes: { amount?: unknown; type?: unknown },
): string | null {
  const amountChanged =
    changes.amount !== undefined &&
    changes.amount !== null &&
    changes.amount !== '' &&
    toCents(changes.amount as number | string) !== toCents(current.amount);
  const typeChanged = changes.type !== undefined && changes.type !== null && changes.type !== current.type;
  if (!amountChanged && !typeChanged) return null;
  const what = amountChanged && typeChanged ? 'amount and type' : amountChanged ? 'amount' : 'type';
  return (
    `This transaction is one side of a transfer, so its ${what} can't be changed on its own: ` +
    'the other side would no longer match. Unlink the transfer first, or delete both sides and add it again. ' +
    'Category, notes and date can still be changed.'
  );
}
