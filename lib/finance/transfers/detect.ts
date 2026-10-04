// lib/finance/transfers/detect.ts
// Finds transactions that look like money moving between a person's own
// accounts: the two sides of a transfer, a credit-card payment, a loan payment.
//
// It only suggests. Same amount and a close date are not enough to be sure
// (round amounts collide: one $300 loan transfer can sit next to three $300
// card payments on the same day), so every suggestion carries a confidence
// and nothing here writes anything.
//
// Pure functions: no database, no network. Runs in API routes and under
// `node --test --experimental-strip-types` (tests/unit/transfer-detect.test.ts).
// Relative imports end in `.ts` because Node's type stripping does not resolve
// extensionless paths. Client components import ./pairing.ts instead: this
// file pulls in the CSV parser.

import { daysBetween } from '../transaction-matching.ts';
import { transferHints } from '../csv-import/parse.ts';
import { accountClass, accountLabel, kindForDestination } from './pairing.ts';
import type { AccountRef, TransferKind } from './pairing.ts';

/** Two rows can be the sides of one transfer when their dates are this many days apart or fewer. */
export const TRANSFER_WINDOW_DAYS = 5;

/** A transaction, as the detector sees it. */
export interface DetectRow {
  id: string;
  account_id: string | null;
  /** YYYY-MM-DD. */
  date: string;
  /** Positive whole cents; `type` carries the direction. */
  amountCents: number;
  type: 'expense' | 'income';
  description: string | null;
  vendor: string | null;
  /** Set when the row is already one side of a transfer. Such rows are skipped. */
  transfer_group_id?: string | null;
}

export type DetectAccount = AccountRef;

export interface DetectOptions {
  /** Largest gap between the two dates, in days. Default TRANSFER_WINDOW_DAYS. */
  windowDays?: number;
}

/** Two rows that look like the two sides of one transfer. */
export interface TransferPairSuggestion {
  /** The expense row: the account the money left. */
  fromId: string;
  /** The income row: the account the money reached. */
  toId: string;
  /** From the account the money reached: card -> card_payment, loan -> loan_payment, else transfer. */
  kind: TransferKind;
  /**
   * `high` only when each row has exactly one possible partner (this one) AND
   * a description says so: transfer or payment wording, or the other account's
   * number. Everything else is `low` and needs a person to look.
   */
  confidence: 'high' | 'low';
  daysApart: number;
  /** How many rows could pair with the `from` row, this one included. */
  fromCandidates: number;
  /** How many rows could pair with the `to` row, this one included. */
  toCandidates: number;
  /** Plain-language notes for the review screen. */
  reasons: string[];
}

/**
 * A payment whose other side is not in the data: the description says card or
 * loan payment, and no row on another account matches it.
 */
export interface OneSidedSuggestion {
  rowId: string;
  kind: 'card_payment' | 'loan_payment';
  /** The account the description names, when it names exactly one card or loan. */
  toAccountId: string | null;
  reasons: string[];
}

export interface TransferSuggestions {
  pairs: TransferPairSuggestion[];
  oneSided: OneSidedSuggestion[];
}

/** A row another row could be linked to, for the "Mark as transfer" picker. */
export interface TransferCandidate {
  /** The other row. */
  rowId: string;
  fromId: string;
  toId: string;
  kind: TransferKind;
  daysApart: number;
  reasons: string[];
}

type WordingHint = 'transfer' | 'card_payment' | 'loan_payment';

const KIND_WORDING: Record<TransferKind, string> = {
  transfer: 'a transfer',
  card_payment: 'a card payment',
  loan_payment: 'a loan payment',
};

/** The text hints are read from: the description, then the vendor. */
function textOf(row: DetectRow): string {
  return `${row.description ?? ''} ${row.vendor ?? ''}`.trim();
}

/** transferHints(), minus the hints that say nothing about a transfer (insurance). */
function wordingHints(row: DetectRow): Set<WordingHint> {
  const found = new Set<WordingHint>();
  for (const hint of transferHints(textOf(row))) {
    if (hint === 'transfer' || hint === 'card_payment' || hint === 'loan_payment') found.add(hint);
  }
  return found;
}

/**
 * Whether a description names an account: it contains the account's last four
 * as a whole run of digits ("ONLINE TRANSFER TO SAV ...5345", "XXXXXX5345"),
 * or a number of three or more digits that is part of the account's name
 * ("Transfer To Loan 0089" and an account called "Car Loan 0089", which is
 * how a credit union's share or loan number usually shows up).
 *
 * A longer number that merely ends in the last four does not count.
 */
export function namesAccount(text: string | null | undefined, account: DetectAccount): boolean {
  const runs = (text ?? '').match(/\d+/g);
  if (!runs) return false;
  const lastFour = (account.last_four ?? '').trim();
  if (/^\d{3,}$/.test(lastFour) && runs.includes(lastFour)) return true;
  const nameRuns = (account.name.match(/\d+/g) ?? []).filter((run) => run.length >= 3);
  return nameRuns.some((run) => runs.includes(run));
}

/** What one row's description adds to (or takes from) the case for a pair of a given kind. */
interface Evidence {
  points: number;
  /** True when the description supports this pair: it counts toward `high` confidence. */
  hinted: boolean;
  reasons: string[];
}

function evidenceFor(row: DetectRow, otherAccount: DetectAccount, kind: TransferKind): Evidence {
  const evidence: Evidence = { points: 0, hinted: false, reasons: [] };

  if (namesAccount(textOf(row), otherAccount)) {
    evidence.points += 4;
    evidence.hinted = true;
    evidence.reasons.push(`A description mentions ${accountLabel(otherAccount)}`);
  }

  const hints = wordingHints(row);
  if (hints.has(kind)) {
    // The wording says exactly this: "transfer" between two bank accounts,
    // "payment thank you" on a card, "loan" on a loan.
    evidence.points += 2;
    evidence.hinted = true;
    evidence.reasons.push(`The wording looks like ${KIND_WORDING[kind]}`);
  } else if (kind === 'transfer' ? hints.size > 0 : kind === 'card_payment' && hints.has('loan_payment')) {
    // The wording says something else: a loan payment can't be the other side
    // of a card payment, and payment wording doesn't fit a move between two
    // bank accounts. This is what keeps a $300 loan transfer from taking a
    // $300 card payment's place.
    evidence.points -= 1;
  } else if (hints.size > 0) {
    // General wording that still fits a payment: "transfer" to a card or a
    // loan, "autopay" to a loan.
    evidence.points += 1;
    evidence.hinted = true;
    evidence.reasons.push(`The wording looks like ${hints.has('transfer') ? 'a transfer' : 'a payment'}`);
  }
  return evidence;
}

interface Edge {
  from: DetectRow;
  to: DetectRow;
  kind: TransferKind;
  days: number;
  points: number;
  hinted: boolean;
  reasons: string[];
}

interface EdgeOptions {
  windowDays: number;
  /**
   * Only pair money leaving an asset account (checking, savings, cash). A
   * charge on a card that happens to equal a deposit elsewhere is far more
   * often a coincidence than a cash advance.
   */
  assetOriginOnly: boolean;
}

/**
 * Every pair of rows that could be the two sides of one transfer: an expense
 * and an income, on different accounts, equal to the cent, within the window.
 * Rows already in a transfer, rows with no account (or an unknown one), and
 * rows without a positive amount are left out.
 */
function findEdges(
  rows: readonly DetectRow[],
  accountsById: ReadonlyMap<string, DetectAccount>,
  options: EdgeOptions,
): Edge[] {
  const incomesByCents = new Map<number, DetectRow[]>();
  const expenses: DetectRow[] = [];
  for (const row of rows) {
    if (row.transfer_group_id) continue;
    if (!row.account_id || !accountsById.has(row.account_id)) continue;
    if (!Number.isSafeInteger(row.amountCents) || row.amountCents <= 0) continue;
    if (row.type === 'expense') {
      expenses.push(row);
    } else if (row.type === 'income') {
      const list = incomesByCents.get(row.amountCents);
      if (list) list.push(row);
      else incomesByCents.set(row.amountCents, [row]);
    }
  }

  const edges: Edge[] = [];
  for (const from of expenses) {
    const fromAccount = accountsById.get(from.account_id!)!;
    if (options.assetOriginOnly && accountClass(fromAccount.account_type) !== 'asset') continue;
    for (const to of incomesByCents.get(from.amountCents) ?? []) {
      if (to.account_id === from.account_id) continue;
      const days = daysBetween(from.date, to.date);
      if (days > options.windowDays) continue;
      const toAccount = accountsById.get(to.account_id!)!;
      const kind = kindForDestination(toAccount.account_type);
      const fromEvidence = evidenceFor(from, toAccount, kind);
      const toEvidence = evidenceFor(to, fromAccount, kind);
      edges.push({
        from,
        to,
        kind,
        days,
        points: fromEvidence.points + toEvidence.points,
        hinted: fromEvidence.hinted || toEvidence.hinted,
        reasons: [...new Set([...fromEvidence.reasons, ...toEvidence.reasons])],
      });
    }
  }
  return edges;
}

/** Best first: what the descriptions say, then the closest date, then a fixed order so results never shuffle. */
function byStrength(a: Edge, b: Edge): number {
  return (
    b.points - a.points ||
    a.days - b.days ||
    a.from.date.localeCompare(b.from.date) ||
    a.from.id.localeCompare(b.from.id) ||
    a.to.id.localeCompare(b.to.id)
  );
}

function dateReason(days: number): string {
  if (days === 0) return 'Same amount on the same day';
  return `Same amount, ${days} day${days === 1 ? '' : 's'} apart`;
}

/** The destination a one-sided payment's description names: exactly one card or loan, else null. */
function namedDebtAccount(
  row: DetectRow,
  accounts: readonly DetectAccount[],
  hints: ReadonlySet<WordingHint>,
): DetectAccount | null {
  const named = accounts.filter(
    (account) =>
      account.id !== row.account_id &&
      accountClass(account.account_type) === 'debt' &&
      namesAccount(textOf(row), account),
  );
  if (named.length === 1) return named[0];
  // Two accounts share the number: the wording may still settle it ("loan").
  const fitting = named.filter((account) => hints.has(kindForDestination(account.account_type)));
  return fitting.length === 1 ? fitting[0] : null;
}

/**
 * Suggests which rows are the two sides of a transfer between the person's
 * own accounts, and which are payments whose other side is missing.
 *
 * **Candidates.** An expense and an income on different accounts, equal to
 * the cent, at most `windowDays` apart, where the expense is on an asset
 * account (checking, savings, cash). The income side decides the kind: on an
 * asset account it is a transfer, on a `credit_card` a card payment, on a
 * `loan` a loan payment (an income row on a card or loan lowers what is owed).
 * Rows that are already grouped, have no account, or sit on the same account
 * are never paired.
 *
 * **Scoring.** A description that names the other account's last four (or a
 * number in its name) counts most; wording that fits the kind next
 * (transferHints); wording that contradicts it counts against; the closest
 * date breaks ties.
 *
 * **Assignment.** Greedy and one-to-one: the strongest pair is taken first and
 * each row is used at most once.
 *
 * **Confidence.** `high` only when both rows have exactly one candidate (each
 * other) and a description supports the pair. Anything else is `low`.
 *
 * **One-sided.** An expense on an asset account that ends up unpaired and
 * whose wording says loan or card payment, when the person has such an
 * account. `toAccountId` is set only when the description names one.
 *
 * Results are sorted: high confidence first, then newest first.
 */
export function suggestTransferPairs(
  rows: readonly DetectRow[],
  accounts: readonly DetectAccount[],
  opts: DetectOptions = {},
): TransferSuggestions {
  const windowDays = opts.windowDays ?? TRANSFER_WINDOW_DAYS;
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const edges = findEdges(rows, accountsById, { windowDays, assetOriginOnly: true });

  const fromCounts = new Map<string, number>();
  const toCounts = new Map<string, number>();
  for (const edge of edges) {
    fromCounts.set(edge.from.id, (fromCounts.get(edge.from.id) ?? 0) + 1);
    toCounts.set(edge.to.id, (toCounts.get(edge.to.id) ?? 0) + 1);
  }

  const used = new Set<string>();
  const chosen: Edge[] = [];
  for (const edge of [...edges].sort(byStrength)) {
    if (used.has(edge.from.id) || used.has(edge.to.id)) continue;
    used.add(edge.from.id);
    used.add(edge.to.id);
    chosen.push(edge);
  }

  const pairs: TransferPairSuggestion[] = chosen.map((edge) => {
    const fromCandidates = fromCounts.get(edge.from.id) ?? 1;
    const toCandidates = toCounts.get(edge.to.id) ?? 1;
    const onlyChoice = fromCandidates === 1 && toCandidates === 1;
    const reasons = [dateReason(edge.days), ...edge.reasons];
    if (!onlyChoice) {
      const most = Math.max(fromCandidates, toCandidates);
      reasons.push(`${most} transactions with this amount could be the other side, so check this pair`);
    }
    if (!edge.hinted) reasons.push('Nothing in the descriptions says this is a transfer');
    return {
      fromId: edge.from.id,
      toId: edge.to.id,
      kind: edge.kind,
      confidence: onlyChoice && edge.hinted ? 'high' : 'low',
      daysApart: edge.days,
      fromCandidates,
      toCandidates,
      reasons,
    };
  });

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const newestFirst = (a: string, b: string): number =>
    (rowsById.get(b)?.date ?? '').localeCompare(rowsById.get(a)?.date ?? '') || a.localeCompare(b);
  pairs.sort(
    (a, b) =>
      (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1) || newestFirst(a.fromId, b.fromId),
  );

  const hasLoan = accounts.some((account) => account.account_type === 'loan');
  const hasCard = accounts.some((account) => account.account_type === 'credit_card');
  const oneSided: OneSidedSuggestion[] = [];
  for (const row of rows) {
    if (row.type !== 'expense' || used.has(row.id) || row.transfer_group_id) continue;
    if (!Number.isSafeInteger(row.amountCents) || row.amountCents <= 0) continue;
    const account = row.account_id ? accountsById.get(row.account_id) : undefined;
    if (!account || accountClass(account.account_type) !== 'asset') continue;

    const hints = wordingHints(row);
    const saysLoan = hints.has('loan_payment') && hasLoan;
    const saysCard = hints.has('card_payment') && hasCard;
    if (!saysLoan && !saysCard) continue;

    const named = namedDebtAccount(row, accounts, hints);
    const kind = named
      ? (kindForDestination(named.account_type) as 'card_payment' | 'loan_payment')
      : saysLoan
        ? 'loan_payment'
        : 'card_payment';
    const reasons = [`The wording looks like ${KIND_WORDING[kind]}`];
    if (named) reasons.push(`The description mentions ${accountLabel(named)}`);
    reasons.push('No matching transaction was found on another account');
    oneSided.push({ rowId: row.id, kind, toAccountId: named?.id ?? null, reasons });
  }
  oneSided.sort(
    (a, b) => (a.toAccountId ? 0 : 1) - (b.toAccountId ? 0 : 1) || newestFirst(a.rowId, b.rowId),
  );

  return { pairs, oneSided };
}

/**
 * Every row that could be the other side of `rowId`, strongest first, for a
 * person choosing by hand. Unlike suggestTransferPairs this is not one-to-one
 * and it also offers pairs that start on a card or loan (a cash advance, a
 * balance transfer): the person is looking at the rows and deciding.
 */
export function transferCandidatesFor(
  rowId: string,
  rows: readonly DetectRow[],
  accounts: readonly DetectAccount[],
  opts: DetectOptions = {},
): TransferCandidate[] {
  const windowDays = opts.windowDays ?? TRANSFER_WINDOW_DAYS;
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  return findEdges(rows, accountsById, { windowDays, assetOriginOnly: false })
    .filter((edge) => edge.from.id === rowId || edge.to.id === rowId)
    .sort(byStrength)
    .map((edge) => ({
      rowId: edge.from.id === rowId ? edge.to.id : edge.from.id,
      fromId: edge.from.id,
      toId: edge.to.id,
      kind: edge.kind,
      daysApart: edge.days,
      reasons: [dateReason(edge.days), ...edge.reasons],
    }));
}
