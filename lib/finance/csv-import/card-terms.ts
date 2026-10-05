// lib/finance/csv-import/card-terms.ts
// Card and loan words for the statement import. A credit card or loan
// statement is read in the person's own terms (Charge, Payment, Refund or
// credit, Interest, Fee) instead of "expense / income", and a payment is a
// transfer between two of the person's accounts, not earnings.
//
// How the words map to what is stored (financial_transactions.type), the
// same rule the balances use (app/api/finance/accounts/route.ts):
//   charge, interest, fee  -> expense on the card (what is owed goes up)
//   payment, refund        -> income on the card  (what is owed goes down)
// A payment is then linked to the account it was paid from as a transfer
// (transfer_kind 'card_payment' or 'loan_payment'), so it never counts as
// income. A refund stays on the card as negative spending (see
// lib/finance/refunds.ts).
//
// Pure functions: no React, no network. Relative imports end in `.ts` for
// `node --test --experimental-strip-types` (tests/unit/card-terms.test.ts).

import type { SignConvention, TransactionType, TransferHint } from './types.ts';

export type CardRowKind = 'charge' | 'payment' | 'refund' | 'interest' | 'fee';

export const CARD_ROW_KINDS: readonly CardRowKind[] = ['charge', 'payment', 'refund', 'interest', 'fee'];

/** True for the account types whose balance is money owed: credit cards and loans. */
export function isDebtAccountType(accountType: string | null | undefined): boolean {
  return accountType === 'credit_card' || accountType === 'loan';
}

/** The words for each kind. A loan has no refunds, so its money-back row is a "Credit". */
export function cardKindLabel(kind: CardRowKind, accountType?: string | null): string {
  if (kind === 'refund') return accountType === 'loan' ? 'Credit' : 'Refund or credit';
  return { charge: 'Charge', payment: 'Payment', interest: 'Interest', fee: 'Fee' }[kind];
}

/** What a kind is stored as on the card or loan. */
export function typeForCardKind(kind: CardRowKind): TransactionType {
  return kind === 'payment' || kind === 'refund' ? 'income' : 'expense';
}

// "INTEREST CHARGED TO STANDARD PURCH", "Interest Charge on Purchases",
// "FINANCE CHARGE", "INTEREST CHARGE:PURCHASES". Not "No interest if paid in full".
const INTEREST_WORDS = /\b(?:interest charge[ds]?|interest charged|finance charge|purchase interest|interest on)\b|^interest\b/i;
// "LATE FEE", "Fee Credit Card", "ANNUAL FEE", "PAST DUE FEE", "LATE CHARGE".
const FEE_WORDS = /\b(?:fees?|late charge|annual charge|returned payment charge)\b/i;
const NOT_A_CHARGE = /\b(?:refund|reversal|reversed|waive[dr]?)\b/i;
const PAYMENT_WORDS = /\bpayments?\b|\bpymt\b|\bpmt\b/i;
const NOT_A_PAYMENT = /\b(?:reversal|reversed|returned|refund)\b/i;

/** The PDF statement kinds (lib/finance/pdf-import/types.ts) in card terms. */
const STATEMENT_KIND: Record<string, CardRowKind> = {
  purchase: 'charge',
  cash_advance: 'charge',
  fee: 'fee',
  interest: 'interest',
  payment: 'payment',
  credit: 'refund',
};

export interface CardTermsRow {
  type: TransactionType;
  description: string;
  hints?: readonly TransferHint[];
  /** The PDF statement's own kind for the row, when it has one. */
  kind?: string;
}

/**
 * What a card or loan row is, in card terms, for the direction it will be
 * saved with. A PDF statement's section wins (it knows which rows are fees
 * and interest); otherwise the description decides:
 * - money in: a payment when it says so ("PAYMENT THANK YOU", "AUTOPAY",
 *   "Payment Home Banking Transfer") or a transfer hint, else a refund;
 * - money out: interest or a fee when the words say so, else a charge.
 * `type` overrides the row's own direction (the person flipped it).
 */
export function cardKindFor(row: CardTermsRow, type: TransactionType = row.type): CardRowKind {
  const fromStatement = row.kind ? STATEMENT_KIND[row.kind] : undefined;
  if (fromStatement && typeForCardKind(fromStatement) === type) return fromStatement;

  const text = row.description ?? '';
  const hints = row.hints ?? [];
  if (type === 'income') {
    if (NOT_A_PAYMENT.test(text)) return 'refund';
    if (hints.includes('card_payment') || hints.includes('loan_payment') || PAYMENT_WORDS.test(text)) return 'payment';
    // A credit union's "Transfer From Share" onto a card or loan is a payment from savings.
    if (hints.includes('transfer')) return 'payment';
    return 'refund';
  }
  if (NOT_A_CHARGE.test(text)) return 'charge';
  if (INTEREST_WORDS.test(text)) return 'interest';
  if (FEE_WORDS.test(text)) return 'fee';
  return 'charge';
}

/** How many rows of each kind, for "42 charges, 3 payments" lines. */
export function countCardKinds(rows: readonly CardTermsRow[]): Record<CardRowKind, number> {
  const counts: Record<CardRowKind, number> = { charge: 0, payment: 0, refund: 0, interest: 0, fee: 0 };
  for (const row of rows) counts[cardKindFor(row)] += 1;
  return counts;
}

/** "42 charges, 3 payments, 1 refund or credit": the kinds that occur, in a fixed order. */
export function cardKindSummary(counts: Record<CardRowKind, number>, accountType?: string | null): string {
  const plural: Record<CardRowKind, [string, string]> = {
    charge: ['charge', 'charges'],
    payment: ['payment', 'payments'],
    refund: accountType === 'loan' ? ['credit', 'credits'] : ['refund or credit', 'refunds or credits'],
    interest: ['interest charge', 'interest charges'],
    fee: ['fee', 'fees'],
  };
  const parts = CARD_ROW_KINDS.filter((kind) => counts[kind] > 0).map(
    (kind) => `${counts[kind].toLocaleString('en-US')} ${counts[kind] === 1 ? plural[kind][0] : plural[kind][1]}`,
  );
  return parts.length > 0 ? parts.join(', ') : 'no rows';
}

/**
 * One line that says what the import will do for this kind of account,
 * shown above the review list.
 */
export function importExplanation(accountType: string | null | undefined): string {
  if (accountType === 'credit_card') {
    return 'Charges, interest and fees add to what you owe on this card. Payments and refunds lower it. A payment is linked to the account it was paid from, so it is never counted as income, and a refund counts as less spending, not earnings.';
  }
  if (accountType === 'loan') {
    return 'Charges, interest and fees add to what you owe on this loan. Payments lower it, and each payment is linked to the account it was paid from, so it is never counted as income.';
  }
  return 'Money out is saved as an expense and money in as income. A payment to one of your cards or loans can be linked to it as a transfer, so it is not counted as spending.';
}

/** The sign-convention choices, worded for the account. */
export function signOptionText(
  sign: SignConvention,
  accountType: string | null | undefined,
): { label: string; hint: string } {
  const debt = isDebtAccountType(accountType);
  switch (sign) {
    case 'negative_is_expense':
      return debt
        ? { label: 'Charges appear as negative numbers', hint: 'One amount column. Payments and refunds are positive.' }
        : { label: 'Purchases are negative numbers', hint: 'One amount column. Money coming in is positive.' };
    case 'positive_is_expense':
      return debt
        ? { label: 'Charges appear as positive numbers', hint: 'One amount column. Payments and refunds are negative.' }
        : { label: 'Purchases are positive numbers', hint: 'One amount column. Payments and refunds are negative.' };
    case 'split_columns':
      return debt
        ? { label: 'Separate charge and payment columns', hint: 'Charges are in one column; payments and refunds in another.' }
        : { label: 'Separate debit and credit columns', hint: 'Money out is in one column and money in is in another.' };
    case 'type_column':
    default:
      return {
        label: 'A type column says debit or credit',
        hint: 'Amounts have no sign. Another column says which way the money went.',
      };
  }
}

// ── Payments as transfers ─────────────────────────────────────────────────

/**
 * Which side of a transfer a statement row can be.
 * - `paid_from`: a payment on a card or loan; the other side is money out of
 *   the account it was paid from ("Paid from...").
 * - `paid_to`: money out of a bank account whose wording says it paid a card
 *   or loan; the other side is the payment on that card or loan ("This paid...").
 * - `cash_withdrawal`: money out of a bank account whose wording says it was
 *   taken out as cash (ATM, branch, teller; lib/finance/cash/withdrawal.ts);
 *   the other side is the same amount coming into a cash account
 *   ("Cash withdrawal -> into...").
 * - null: an ordinary row.
 */
export type TransferRole = 'paid_from' | 'paid_to' | 'cash_withdrawal' | null;

export function transferRoleFor(
  row: CardTermsRow,
  accountType: string | null | undefined,
  type: TransactionType = row.type,
): TransferRole {
  if (isDebtAccountType(accountType)) {
    return type === 'income' && cardKindFor(row, type) === 'payment' ? 'paid_from' : null;
  }
  if (type !== 'expense') return null;
  const hints = row.hints ?? [];
  // Cash wording wins: "ATM WITHDRAWAL CAPITAL ONE" is cash from a Capital One ATM, not a card payment.
  // A cash account's own statement has no withdrawals into cash.
  if (hints.includes('cash_withdrawal') && accountType !== 'cash') return 'cash_withdrawal';
  return hints.includes('card_payment') || hints.includes('loan_payment') ? 'paid_to' : null;
}

export interface PickerAccount {
  id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  last_four?: string | null;
  is_active?: boolean | null;
  /** Migration 210; missing means USD. */
  currency?: string | null;
}

const currencyOf = (account: Pick<PickerAccount, 'currency'> | undefined): string => account?.currency || 'USD';

/**
 * The accounts a row's "Paid from", "This paid" or "Cash withdrawal into"
 * picker offers: every other active account for a payment (bank accounts
 * first), only cards and loans for a bank payment, and only cash accounts in
 * this account's currency for a cash withdrawal (the same amount lands on both
 * sides; cash in another currency is Exchange money).
 */
export function transferPickerAccounts<T extends PickerAccount>(
  role: Exclude<TransferRole, null>,
  accounts: readonly T[],
  thisAccountId: string,
): T[] {
  const others = accounts.filter((account) => account.id !== thisAccountId && account.is_active !== false);
  if (role === 'paid_to') return others.filter((account) => isDebtAccountType(account.account_type));
  if (role === 'cash_withdrawal') {
    const currency = currencyOf(accounts.find((account) => account.id === thisAccountId));
    return others.filter((account) => account.account_type === 'cash' && currencyOf(account) === currency);
  }
  return [...others].sort((a, b) => Number(isDebtAccountType(a.account_type)) - Number(isDebtAccountType(b.account_type)));
}

/** Active cash accounts in another currency than this account: a withdrawal into them is Exchange money. */
export function otherCurrencyCashAccounts<T extends PickerAccount>(accounts: readonly T[], thisAccountId: string): T[] {
  const currency = currencyOf(accounts.find((account) => account.id === thisAccountId));
  return accounts.filter(
    (account) =>
      account.id !== thisAccountId &&
      account.is_active !== false &&
      account.account_type === 'cash' &&
      currencyOf(account) !== currency,
  );
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length >= 4 && !['card', 'bank', 'credit', 'visa', 'mastercard', 'account', 'checking', 'savings'].includes(word));

/**
 * The card or loan a bank row's description names, when exactly one fits:
 * its last four digits, or a distinctive word of its institution or name
 * ("CAPITAL ONE" -> an account at Capital One). Null when none or several
 * fit, so the person chooses.
 */
export function accountNamedIn<T extends PickerAccount>(description: string, candidates: readonly T[]): T | null {
  const text = ` ${description.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const byDigits = candidates.filter((account) => account.last_four && text.includes(` ${account.last_four} `));
  if (byDigits.length === 1) return byDigits[0];
  const byName = candidates.filter((account) =>
    words(`${account.institution_name ?? ''} ${account.name}`).some((word) => text.includes(` ${word} `)),
  );
  return byName.length === 1 ? byName[0] : null;
}
