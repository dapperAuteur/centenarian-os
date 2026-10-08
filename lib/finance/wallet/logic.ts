// lib/finance/wallet/logic.ts
// The Wallet's formulas (plans/66 Part 2, W1): one page that answers "what do I have, what do I
// owe, and am I on track". Pure; the database reads are in ./server.ts.
//
// EVERY FIGURE IS AN ESTIMATE, labelled as one on the page. The rules, in one place (the help
// article "Your Wallet" says the same in plain words):
//
//   Currency
//     - Each amount starts in its own currency (the account's) and is converted to your home
//       currency (Settings → My currencies) at today's rate: cache first, one lookup per currency,
//       the same call the accounts list uses (lib/finance/fx/rates.ts getRate).
//     - An amount with no rate is left out of every total and listed under "No exchange rate yet".
//       Nothing foreign is ever added at face value.
//     - A card's amount owed and its limit convert at the same rate, so its % used is exact.
//     - Equipment and vehicles have no currency: they count as home currency.
//
//   Cash (physical cash only)
//     - Active accounts of type cash. Balance = the one balance rule (lib/finance/balance).
//     - A pocket counted more than 30 days ago, or never, asks for a count (amber), once counting
//       is set up (migration 213). An overdrawn pocket is amber.
//
//   Checking and savings (shown apart from cash)
//     - Active checking and savings accounts, the same balance rule.
//     - "Set aside in savings goals" = what goals funded from these accounts hold (starting amount
//       + allocations, migration 212). Shown, never subtracted: the money is still in the account.
//
//   Credit cards and lines of credit
//     - Credit cards, plus loans that have a limit (a line of credit). Owed = amountOwed().
//     - Limit = creditLimitFor(): the account's limit, else the latest statement's.
//     - used = sum of max(0, owed) over the ones with a known limit (an overpaid card never offsets
//       another card's balance); limit_total = sum of those limits; % used = used / limit_total;
//       available = limit_total - used.
//     - A card with no known limit is listed and left out of the %.
//     - Amber at CREDIT_WARN_PERCENT (30%) or more, overall or on one card: a common rule of thumb,
//       not a rule. Over the limit is amber too. (Per-account thresholds come with plans/66 W2.)
//
//   Loans (a loan with no limit)
//     - Starting balance and date: the opening balance and its "as of" date (migration 221), else
//       the day the account was added. When the opening balance is 0, the first charge on the loan
//       (the expenses on the earliest day that counts toward the balance: usually the amount paid
//       out) and its date. Labelled "Starting balance", not "original amount": the app's guidance
//       sets it from the first imported statement, so it is where the records start, not always
//       what was first borrowed. An original amount and date per loan need their own columns
//       (a later migration). Owed now: amountOwed() as of the latest transaction.
//     - Monthly payment: the latest statement's minimum, else the latest payment transfer tracking
//       linked into the loan (debt/overview.ts latestLinkedPayment), else unknown: no payoff date
//       until there is one. Never the credit-card minimum formula the Debt page estimates with
//       (max($25, 1% + a month's interest)): an installment loan has a fixed payment, and that
//       formula would put most loans' payoff years too late.
//     - Payoff at that payment: month by month at APR / 12 (lib/finance/debt/amortize.ts
//       payoffSchedule), first payment a month from today. A payment that doesn't cover the first
//       month's interest "never pays off"; one that covers it but needs more than 600 payments
//       (MAX_MONTHS) "takes more than 50 years". The two are told apart: a low payment on a big
//       mortgage, or any payment on a loan with no APR, is slow, not hopeless.
//     - A custom payment: the same schedule at that amount, the new payoff date, and the interest
//       saved against the minimum (comparePayoff).
//
//   Assets (equipment you own and your vehicles)
//     - Equipment: active, ownership 'own'. Vehicles: active, yours (not a system vehicle),
//       ownership 'owned'.
//     - Two values side by side: your value (equipment.current_value, entered by hand; it starts at
//       the purchase price and changes with each valuation) and the depreciated book value
//       (asset_depreciation, migration 214). The total uses your value, else book value, else the
//       purchase price; a vehicle has only book value until vehicle values arrive (plans/66 W2).
//       Items with no value are counted and listed.
//
//   Retirement
//     - Funds = the retirement planner's current total (every investment account, home currency).
//     - Years left = retirement age - age, never below 0; empty when no age is set. Age 65 when
//       none is set, marked "assumed".
//     - On track (green) when the planner's gap is zero or less; otherwise amber: short by the gap,
//       about the extra a month.
//
//   Net worth (an estimate)
//     - cash + checking and savings + retirement + permanent-policy cash value + assets
//       - sum of max(0, owed) over cards, lines of credit and loans.
//
// Relative imports end in .ts for `node --test --experimental-strip-types` (tests/unit/wallet.test.ts).

import { convert } from '../fx/math.ts';
import { countFreshness } from '../cash/logic.ts';
import { countsInBalance } from '../balance/logic.ts';
import type { CountFreshness } from '../cash/logic.ts';
import { MAX_MONTHS, monthlyInterestCents, payoffSchedule, toCents } from '../debt/amortize.ts';
import type { CreditLimitSource } from '../debt/credit-limit.ts';
import { POLICY_GROUPS, policyGroup } from '../insurance/logic.ts';
import type { PolicyGroup } from '../insurance/logic.ts';

/** % of a limit used that turns amber: a common rule of thumb, not a rule. */
export const CREDIT_WARN_PERCENT = 30;

/** How many items with no value, or loans and cards, a card lists before "and N more". */
export const LIST_LIMIT = 5;

const round2 = (n: number): number => Math.round(n * 100) / 100;
const cents = (n: number): number => Math.round(n * 100);

// ── Currency ─────────────────────────────────────────────────────────────────

/** currency code -> how much 1 unit is in the home currency; null when no rate is known. */
export type RateMap = ReadonlyMap<string, number | null>;

/** An amount in the home currency, or null when its currency has no rate yet. */
export function toHome(amount: number, currency: string, home: string, rates: RateMap): number | null {
  if (!Number.isFinite(amount)) return null;
  if (currency === home) return round2(amount);
  const rate = rates.get(currency);
  if (rate === null || rate === undefined || !(rate > 0)) return null;
  return convert(amount, rate);
}

export interface UnconvertedItem {
  section: 'cash' | 'bank' | 'credit' | 'loans';
  id: string;
  name: string;
  currency: string;
  amount: number;
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface WalletAccountIn {
  id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  last_four?: string | null;
  currency: string;
  /** Signed balance in the account's currency (debts negative): the accounts list's balance. */
  balance: number;
  opening_balance?: number | string | null;
  opening_balance_date?: string | null;
  created_at?: string | null;
  /** Date of the latest transaction on the account, YYYY-MM-DD. */
  last_activity?: string | null;
  /** Cards and loans: from creditLimitFor(). */
  credit_limit?: number | null;
  credit_limit_source?: CreditLimitSource | null;
  apr?: number | null;
  apr_source?: 'statement' | 'account' | null;
  minimum_payment?: number | null;
  /** True when minimum_payment is the card formula's estimate, not a statement's minimum. */
  minimum_estimated?: boolean;
  /** Loans: the latest linked payment into the account (debt/overview.ts latestLinkedPayment). */
  last_payment?: number | null;
  last_payment_date?: string | null;
  /** Loans: the first charge on the account (firstCharge), the start when the opening balance is 0. */
  first_charge?: number | null;
  first_charge_date?: string | null;
}

export interface EquipmentIn {
  id: string;
  name: string;
  purchase_price?: number | string | null;
  current_value?: number | string | null;
  ownership_type?: string | null;
  is_active?: boolean | null;
}

export interface VehicleIn {
  id: string;
  nickname: string;
  ownership_type?: string | null;
  is_system?: boolean | null;
  active?: boolean | null;
}

export interface RetirementIn {
  ready: boolean;
  funds: number;
  accounts: number;
  years_left: number | null;
  retirement_age: number;
  age_assumed: boolean;
  age_missing: boolean;
  gap: number | null;
  extra_monthly: number | null;
  unconverted: number;
  policy_cash_value: number;
}

export interface PolicyIn {
  kind: string;
  coverage_amount?: number | string | null;
  currency?: string | null;
  is_active?: boolean | null;
}

export interface WalletInput {
  today: string;
  home: string;
  rates: RateMap;
  accounts: readonly WalletAccountIn[];
  /** account id -> last count date (YYYY-MM-DD or timestamp). */
  lastCounts: ReadonlyMap<string, string>;
  /** False before migration 213: no account can be counted yet. */
  countsReady: boolean;
  /** account id -> what savings goals funded from it hold, in the account's currency. */
  goalsHeld: ReadonlyMap<string, number>;
  equipment: readonly EquipmentIn[];
  vehicles: readonly VehicleIn[];
  /** Depreciated book values by item id; null when migration 214 isn't applied. */
  bookValues: { equipment: ReadonlyMap<string, number>; vehicles: ReadonlyMap<string, number> } | null;
  retirement: RetirementIn | null;
  /** Active policies; null before migration 215. */
  policies: readonly PolicyIn[] | null;
}

// ── Outputs ──────────────────────────────────────────────────────────────────

export interface CashPocketView {
  id: string;
  name: string;
  currency: string;
  balance: number;
  home: number | null;
  overdrawn: boolean;
  count_status: CountFreshness;
  days_since_count: number | null;
  /** Never counted or counted more than 30 days ago (only once counting is set up). */
  needs_count: boolean;
}

export interface CashSection {
  total: number;
  pockets: CashPocketView[];
  needs_count: number;
  counts_ready: boolean;
}

export interface BankAccountView {
  id: string;
  name: string;
  account_type: 'checking' | 'savings';
  institution: string | null;
  last_four: string | null;
  currency: string;
  balance: number;
  home: number | null;
  overdrawn: boolean;
  set_aside: number;
  set_aside_home: number | null;
}

export interface BankSection {
  total: number;
  checking: number;
  savings: number;
  set_aside: number;
  accounts: BankAccountView[];
}

export interface CreditLineView {
  id: string;
  name: string;
  kind: 'credit_card' | 'line_of_credit';
  institution: string | null;
  last_four: string | null;
  currency: string;
  /** In the account's currency; negative = a credit (overpaid). */
  owed: number;
  owed_home: number | null;
  limit: number | null;
  limit_source: CreditLimitSource | null;
  limit_home: number | null;
  /** max(0, owed) / limit x 100, one decimal; null without a limit. */
  percent: number | null;
  over_limit: boolean;
  warn: boolean;
}

export interface CreditSection {
  threshold: number;
  used: number;
  limit_total: number;
  available: number;
  percent: number | null;
  warn: boolean;
  lines: CreditLineView[];
  /** Cards with no known limit: their owed (home) is not in the %. */
  no_limit_count: number;
  no_limit_owed: number;
}

export interface PayoffSummary {
  months: number | null;
  payoff_date: string | null;
  /** Interest until payoff; not meaningful (and not shown) when there is no payoff date. */
  total_interest: number;
  /** The payment doesn't cover the first month's interest, so the balance never goes down. */
  never_pays_off: boolean;
  /** The payment covers the interest, but paying off takes more than MAX_MONTHS payments (50 years). */
  over_max: boolean;
}

/** How long a schedule is computed: payoffs past it read "more than 50 years". */
export const PAYOFF_MAX_YEARS = MAX_MONTHS / 12;

export interface LoanView {
  id: string;
  name: string;
  institution: string | null;
  last_four: string | null;
  currency: string;
  /** The starting balance: the opening balance, else (when that is 0) the first charge. */
  starting_amount: number;
  starting_date: string | null;
  starting_date_source: 'starting_balance_date' | 'added' | 'first_charge' | null;
  owed: number;
  owed_home: number | null;
  as_of: string;
  /** starting - owed (account currency); negative when the loan grew. */
  paid_down: number;
  /** paid_down / starting x 100, one decimal; null when the start is 0. */
  paid_percent: number | null;
  apr: number | null;
  apr_source: 'statement' | 'account' | null;
  /** The monthly payment the payoff date uses; null when neither a statement nor a payment gives one. */
  minimum: number | null;
  minimum_source: 'statement' | 'last_payment' | null;
  /** The day of the last payment when minimum_source is 'last_payment'. */
  minimum_date: string | null;
  /** Payoff at `minimum`; null when it is unknown. */
  at_minimum: PayoffSummary | null;
}

export interface LoansSection {
  owed: number;
  /** Sum of the known monthly payments on loans still owed. */
  minimums: number;
  /** Loans still owed with no known monthly payment. */
  no_payment_count: number;
  loans: LoanView[];
}

export interface AssetItemView {
  kind: 'equipment' | 'vehicle';
  id: string;
  name: string;
  href: string;
  your_value: number | null;
  book_value: number | null;
  purchase_price: number | null;
  value: number | null;
  value_source: 'your_value' | 'book_value' | 'purchase_price' | null;
}

export interface AssetsSection {
  total: number;
  your_value_total: number;
  book_value_total: number;
  book_value_items: number;
  count: number;
  equipment_count: number;
  vehicle_count: number;
  /** Highest value first, up to LIST_LIMIT. */
  top: AssetItemView[];
  no_value: AssetItemView[];
  no_value_count: number;
  depreciation_ready: boolean;
}

export interface RetirementSection extends RetirementIn {
  on_track: boolean | null;
}

export interface InsuranceLine {
  ready: boolean;
  coverage: Record<PolicyGroup, number>;
  counts: Record<PolicyGroup, number>;
  /** Policies in another currency are left out of the coverage lines. */
  other_currency: number;
}

export interface NetWorth {
  total: number;
  cash: number;
  bank: number;
  retirement: number;
  policy_cash_value: number;
  assets: number;
  debts: number;
}

export interface WalletView {
  today: string;
  home_currency: string;
  net_worth: NetWorth;
  cash: CashSection;
  bank: BankSection;
  credit: CreditSection;
  loans: LoansSection;
  assets: AssetsSection;
  retirement: RetirementSection | null;
  insurance: InsuranceLine;
  unconverted: UnconvertedItem[];
}

// ── Sections ─────────────────────────────────────────────────────────────────

function sumHome(values: readonly (number | null)[]): number {
  return values.reduce<number>((s, v) => s + (v === null ? 0 : cents(v)), 0) / 100;
}

export function cashSection(input: WalletInput, unconverted: UnconvertedItem[]): CashSection {
  const pockets = input.accounts
    .filter((a) => a.account_type === 'cash')
    .map((a): CashPocketView => {
      const home = toHome(a.balance, a.currency, input.home, input.rates);
      if (home === null) unconverted.push({ section: 'cash', id: a.id, name: a.name, currency: a.currency, amount: a.balance });
      const fresh = countFreshness(input.lastCounts.get(a.id) ?? null, input.today);
      return {
        id: a.id,
        name: a.name,
        currency: a.currency,
        balance: a.balance,
        home,
        overdrawn: a.balance < 0,
        count_status: fresh.status,
        days_since_count: fresh.days,
        needs_count: input.countsReady && fresh.status !== 'fresh',
      };
    });
  return {
    total: sumHome(pockets.map((p) => p.home)),
    pockets,
    needs_count: pockets.filter((p) => p.needs_count).length,
    counts_ready: input.countsReady,
  };
}

export function bankSection(input: WalletInput, unconverted: UnconvertedItem[]): BankSection {
  const accounts = input.accounts
    .filter((a) => a.account_type === 'checking' || a.account_type === 'savings')
    .map((a): BankAccountView => {
      const home = toHome(a.balance, a.currency, input.home, input.rates);
      if (home === null) unconverted.push({ section: 'bank', id: a.id, name: a.name, currency: a.currency, amount: a.balance });
      const setAside = round2(input.goalsHeld.get(a.id) ?? 0);
      return {
        id: a.id,
        name: a.name,
        account_type: a.account_type as 'checking' | 'savings',
        institution: a.institution_name ?? null,
        last_four: a.last_four ?? null,
        currency: a.currency,
        balance: a.balance,
        home,
        overdrawn: a.balance < 0,
        set_aside: setAside,
        set_aside_home: toHome(setAside, a.currency, input.home, input.rates),
      };
    });
  return {
    total: sumHome(accounts.map((a) => a.home)),
    checking: sumHome(accounts.filter((a) => a.account_type === 'checking').map((a) => a.home)),
    savings: sumHome(accounts.filter((a) => a.account_type === 'savings').map((a) => a.home)),
    set_aside: sumHome(accounts.map((a) => a.set_aside_home)),
    accounts,
  };
}

/** Owed on a card or loan, in its own currency (positive = owed): minus the signed balance. */
function owedOf(a: WalletAccountIn): number {
  return round2(-a.balance);
}

/** A loan with a known limit is a line of credit. */
export function isLineOfCredit(a: Pick<WalletAccountIn, 'account_type' | 'credit_limit'>): boolean {
  return a.account_type === 'loan' && a.credit_limit !== null && a.credit_limit !== undefined && a.credit_limit > 0;
}

export function creditSection(input: WalletInput, unconverted: UnconvertedItem[], threshold = CREDIT_WARN_PERCENT): CreditSection {
  const lines = input.accounts
    .filter((a) => a.account_type === 'credit_card' || isLineOfCredit(a))
    .map((a): CreditLineView => {
      const owed = owedOf(a);
      const limit = a.credit_limit && a.credit_limit > 0 ? a.credit_limit : null;
      const owedHome = toHome(owed, a.currency, input.home, input.rates);
      if (owedHome === null) unconverted.push({ section: 'credit', id: a.id, name: a.name, currency: a.currency, amount: owed });
      const percent = limit === null ? null : Math.round((Math.max(0, owed) / limit) * 1000) / 10;
      const overLimit = limit !== null && owed > limit;
      // Exact cents, not the rounded %: 29.999% is under a 30% threshold.
      const atThreshold = limit !== null && Math.max(0, cents(owed)) * 100 >= threshold * cents(limit);
      return {
        id: a.id,
        name: a.name,
        kind: a.account_type === 'credit_card' ? 'credit_card' : 'line_of_credit',
        institution: a.institution_name ?? null,
        last_four: a.last_four ?? null,
        currency: a.currency,
        owed,
        owed_home: owedHome,
        limit,
        limit_source: limit === null ? null : (a.credit_limit_source ?? 'account'),
        limit_home: limit === null ? null : toHome(limit, a.currency, input.home, input.rates),
        percent,
        over_limit: overLimit,
        warn: overLimit || atThreshold,
      };
    });

  let usedCents = 0;
  let limitCents = 0;
  let noLimitCount = 0;
  let noLimitCents = 0;
  for (const line of lines) {
    if (line.owed_home === null) continue;
    if (line.limit_home === null) {
      noLimitCount += 1;
      noLimitCents += Math.max(0, cents(line.owed_home));
      continue;
    }
    usedCents += Math.max(0, cents(line.owed_home));
    limitCents += cents(line.limit_home);
  }
  const percent = limitCents > 0 ? Math.round((usedCents / limitCents) * 1000) / 10 : null;
  return {
    threshold,
    used: usedCents / 100,
    limit_total: limitCents / 100,
    available: (limitCents - usedCents) / 100,
    percent,
    warn: (limitCents > 0 && usedCents * 100 >= threshold * limitCents) || lines.some((l) => l.over_limit),
    lines,
    no_limit_count: noLimitCount,
    no_limit_owed: noLimitCents / 100,
  };
}

/** Pay `payment` a month from today on: how long and what it costs (no schedule rows). */
export function payoffSummary(balance: number, apr: number | null, payment: number, today: string): PayoffSummary {
  const owed = Math.max(0, balance);
  const r = payoffSchedule(owed, apr, payment, today);
  // payoffSchedule reports both "doesn't cover the interest" and "hit the 600-month cap" as
  // neverPaysOff; only the first is never.
  const coversInterest = toCents(payment) > monthlyInterestCents(toCents(owed), apr);
  return {
    months: r.months,
    payoff_date: r.payoffDate,
    total_interest: r.totalInterest,
    never_pays_off: r.neverPaysOff && !coversInterest,
    over_max: r.neverPaysOff && coversInterest,
  };
}

export interface PayoffComparison {
  /** Null when the loan has no known monthly payment to compare with. */
  minimum: PayoffSummary | null;
  custom: PayoffSummary;
  /** Interest at the minimum - interest at the custom amount; null when either has no payoff date or there is no minimum. */
  interest_saved: number | null;
  /** Months sooner (negative = later); null when either has no payoff date. */
  months_saved: number | null;
}

/** The loan's monthly payment against a custom one (or the custom one alone when there is none). Estimates. */
export function comparePayoff(balance: number, apr: number | null, minimum: number | null, custom: number, today: string): PayoffComparison {
  const atMinimum = minimum !== null && minimum > 0 ? payoffSummary(balance, apr, minimum, today) : null;
  const atCustom = payoffSummary(balance, apr, custom, today);
  const paysOff = (p: PayoffSummary) => !p.never_pays_off && !p.over_max;
  const comparable = atMinimum !== null && paysOff(atMinimum) && paysOff(atCustom);
  return {
    minimum: atMinimum,
    custom: atCustom,
    interest_saved: comparable ? round2(atMinimum.total_interest - atCustom.total_interest) : null,
    months_saved: comparable && atMinimum.months !== null && atCustom.months !== null ? atMinimum.months - atCustom.months : null,
  };
}

/**
 * The custom payment against the loan's monthly payment, in a sentence: the interest saved (or
 * the extra it costs) whenever it differs, even when both finish in the same month, plus how many
 * months sooner or later only when that differs. Null when there is nothing to compare or no
 * difference. `fmt` formats money in the loan's currency.
 */
export function payoffDifferenceText(c: Pick<PayoffComparison, 'interest_saved' | 'months_saved'>, fmt: (amount: number) => string): string | null {
  const interest = c.interest_saved ?? 0;
  const monthsSaved = c.months_saved ?? 0;
  if (c.interest_saved === null || (interest === 0 && monthsSaved === 0)) return null;
  const n = Math.abs(monthsSaved);
  const monthsText = monthsSaved === 0 ? null : `finishes ${n} ${n === 1 ? 'month' : 'months'} ${monthsSaved > 0 ? 'sooner' : 'later'}`;
  const interestText = interest > 0 ? `saves about ${fmt(interest)} in interest` : interest < 0 ? `costs about ${fmt(-interest)} more in interest` : null;
  const parts = [interestText, monthsText].filter((p): p is string => p !== null);
  return `Compared with the monthly payment, that ${parts.join(' and ')}.`;
}

/**
 * A loan's monthly payment: the statement's minimum, else the latest linked payment, else none.
 * The card formula's estimate (minimum_estimated) is never used for a loan.
 */
export function loanPayment(
  a: Pick<WalletAccountIn, 'minimum_payment' | 'minimum_estimated' | 'last_payment' | 'last_payment_date'>,
): { amount: number | null; source: 'statement' | 'last_payment' | null; date: string | null } {
  const statement = a.minimum_estimated !== true && (a.minimum_payment ?? 0) > 0 ? round2(a.minimum_payment!) : null;
  if (statement !== null) return { amount: statement, source: 'statement', date: null };
  const last = (a.last_payment ?? 0) > 0 ? round2(a.last_payment!) : null;
  if (last !== null) return { amount: last, source: 'last_payment', date: a.last_payment_date ?? null };
  return { amount: null, source: null, date: null };
}

/** The day a loan's starting balance is as of: its starting-balance date, else the day it was added. */
export function loanStart(a: Pick<WalletAccountIn, 'opening_balance_date' | 'created_at'>): {
  date: string | null;
  source: 'starting_balance_date' | 'added' | null;
} {
  const set = typeof a.opening_balance_date === 'string' ? a.opening_balance_date.slice(0, 10) : null;
  if (set && /^\d{4}-\d{2}-\d{2}$/.test(set)) return { date: set, source: 'starting_balance_date' };
  const added = typeof a.created_at === 'string' ? a.created_at.slice(0, 10) : null;
  if (added && /^\d{4}-\d{2}-\d{2}$/.test(added)) return { date: added, source: 'added' };
  return { date: null, source: null };
}

/**
 * The first charge on a loan: the expenses on the earliest day that counts toward its balance (after
 * its starting-balance date when one is set), added up, on or before `today`. Usually the amount
 * paid out when it was recorded as a charge. Null when there is none.
 */
export function firstCharge(
  account: { id: string; opening_balance_date?: string | null },
  rows: readonly { account_id: string | null; type: string; amount: number | string; transaction_date: string }[],
  today: string,
): { amount: number; date: string } | null {
  let date: string | null = null;
  let total = 0;
  for (const row of rows) {
    if (row.account_id !== account.id || row.type !== 'expense' || !row.transaction_date) continue;
    const day = row.transaction_date.slice(0, 10);
    if (day > today || !countsInBalance(account, day)) continue;
    const amount = cents(Math.abs(Number(row.amount)));
    if (!Number.isFinite(amount)) continue;
    if (date === null || day < date) {
      date = day;
      total = amount;
    } else if (day === date) {
      total += amount;
    }
  }
  return date === null || total <= 0 ? null : { amount: total / 100, date };
}

/** A loan's starting balance and date (see the rule above). */
export function loanStarting(
  a: Pick<WalletAccountIn, 'opening_balance' | 'opening_balance_date' | 'created_at' | 'first_charge' | 'first_charge_date'>,
): { amount: number; date: string | null; source: LoanView['starting_date_source'] } {
  const opening = round2(Number(a.opening_balance ?? 0) || 0);
  if (opening <= 0 && (a.first_charge ?? 0) > 0 && a.first_charge_date) {
    return { amount: round2(a.first_charge!), date: a.first_charge_date, source: 'first_charge' };
  }
  const start = loanStart(a);
  return { amount: opening, date: start.date, source: start.source };
}

export function loansSection(input: WalletInput, unconverted: UnconvertedItem[]): LoansSection {
  const loans = input.accounts
    .filter((a) => a.account_type === 'loan' && !isLineOfCredit(a))
    .map((a): LoanView => {
      const owed = owedOf(a);
      const owedHome = toHome(owed, a.currency, input.home, input.rates);
      if (owedHome === null) unconverted.push({ section: 'loans', id: a.id, name: a.name, currency: a.currency, amount: owed });
      const start = loanStarting(a);
      const starting = start.amount;
      const paidDown = round2(starting - owed);
      const payment = loanPayment(a);
      return {
        id: a.id,
        name: a.name,
        institution: a.institution_name ?? null,
        last_four: a.last_four ?? null,
        currency: a.currency,
        starting_amount: starting,
        starting_date: start.date,
        starting_date_source: start.source,
        owed,
        owed_home: owedHome,
        as_of: a.last_activity ?? start.date ?? input.today,
        paid_down: paidDown,
        paid_percent: starting > 0 ? Math.round((paidDown / starting) * 1000) / 10 : null,
        apr: a.apr ?? null,
        apr_source: a.apr_source ?? null,
        minimum: payment.amount,
        minimum_source: payment.source,
        minimum_date: payment.date,
        at_minimum: payment.amount === null ? null : payoffSummary(owed, a.apr ?? null, payment.amount, input.today),
      };
    });
  return {
    owed: sumHome(loans.map((l) => (l.owed_home === null ? null : Math.max(0, l.owed_home)))),
    minimums: sumHome(
      loans.map((l) => (l.owed > 0 && l.minimum !== null ? toHome(l.minimum, l.currency, input.home, input.rates) : 0)),
    ),
    no_payment_count: loans.filter((l) => l.owed > 0 && l.minimum === null).length,
    loans,
  };
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Equipment you own and vehicles that are yours (see the rule above). */
export function countedAssets(input: Pick<WalletInput, 'equipment' | 'vehicles'>): { equipment: EquipmentIn[]; vehicles: VehicleIn[] } {
  return {
    equipment: input.equipment.filter((e) => e.is_active !== false && (e.ownership_type ?? 'own') === 'own'),
    vehicles: input.vehicles.filter((v) => v.active !== false && v.is_system !== true && (v.ownership_type ?? 'owned') === 'owned'),
  };
}

export function assetsSection(input: WalletInput): AssetsSection {
  const { equipment, vehicles } = countedAssets(input);
  const books = input.bookValues;
  const items: AssetItemView[] = [
    ...equipment.map((e): AssetItemView => {
      const yours = num(e.current_value);
      const book = books?.equipment.get(e.id) ?? null;
      const price = num(e.purchase_price);
      const value = yours ?? book ?? price;
      return {
        kind: 'equipment',
        id: e.id,
        name: e.name,
        href: `/dashboard/equipment/${e.id}`,
        your_value: yours,
        book_value: book,
        purchase_price: price,
        value,
        value_source: yours !== null ? 'your_value' : book !== null ? 'book_value' : price !== null ? 'purchase_price' : null,
      };
    }),
    ...vehicles.map((v): AssetItemView => {
      const book = books?.vehicles.get(v.id) ?? null;
      return {
        kind: 'vehicle',
        id: v.id,
        name: v.nickname,
        href: `/dashboard/travel/vehicles/${v.id}`,
        your_value: null,
        book_value: book,
        purchase_price: null,
        value: book,
        value_source: book !== null ? 'book_value' : null,
      };
    }),
  ];
  const valued = items.filter((i) => i.value !== null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const noValue = items.filter((i) => i.value === null);
  return {
    total: sumHome(items.map((i) => i.value)),
    your_value_total: sumHome(items.map((i) => i.your_value)),
    book_value_total: sumHome(items.map((i) => i.book_value)),
    book_value_items: items.filter((i) => i.book_value !== null).length,
    count: items.length,
    equipment_count: equipment.length,
    vehicle_count: vehicles.length,
    top: valued.slice(0, LIST_LIMIT),
    no_value: noValue.slice(0, LIST_LIMIT),
    no_value_count: noValue.length,
    depreciation_ready: books !== null,
  };
}

/** The parts of the Retirement page's overview (lib/finance/retirement/server.ts) the Wallet reads. */
export interface RetirementOverviewLike {
  ready: boolean;
  settings_row: { retirement_age?: number | string | null } | null;
  settings: { retirement_age: number; current_age: number | null };
  accounts: readonly unknown[];
  unconverted: number;
  policy_cash_value: number;
  plan: {
    current_total: number;
    years_to_retirement: number | null;
    gap: number | null;
    extra_monthly_needed: number | null;
  } | null;
}

/** The Wallet's retirement figures from the Retirement page's overview, so the two always match. */
export function retirementFromOverview(o: RetirementOverviewLike): RetirementIn {
  const setAge = o.settings_row?.retirement_age;
  return {
    ready: o.ready,
    funds: round2(o.plan?.current_total ?? 0),
    accounts: o.accounts.length,
    years_left: o.plan?.years_to_retirement ?? null,
    retirement_age: o.settings.retirement_age,
    age_assumed: setAge === null || setAge === undefined || setAge === '',
    age_missing: o.settings.current_age === null,
    gap: o.plan?.gap ?? null,
    extra_monthly: o.plan?.extra_monthly_needed ?? null,
    unconverted: o.unconverted,
    policy_cash_value: round2(o.policy_cash_value),
  };
}

export function retirementSection(r: RetirementIn | null): RetirementSection | null {
  if (!r) return null;
  return { ...r, on_track: r.gap === null ? null : r.gap <= 0 };
}

export function insuranceLine(policies: readonly PolicyIn[] | null, home: string): InsuranceLine {
  const coverage = Object.fromEntries(POLICY_GROUPS.map((g) => [g, 0])) as Record<PolicyGroup, number>;
  const counts = Object.fromEntries(POLICY_GROUPS.map((g) => [g, 0])) as Record<PolicyGroup, number>;
  let otherCurrency = 0;
  for (const p of policies ?? []) {
    if (p.is_active === false) continue;
    if ((p.currency || home) !== home) {
      otherCurrency += 1;
      continue;
    }
    const g = policyGroup(p.kind);
    coverage[g] = round2(coverage[g] + (num(p.coverage_amount) ?? 0));
    counts[g] += 1;
  }
  return { ready: policies !== null, coverage, counts, other_currency: otherCurrency };
}

/** Net worth from the sections (see the rule above). Debts = max(0, owed) per card, line and loan. */
export function netWorth(parts: {
  cash: CashSection;
  bank: BankSection;
  credit: CreditSection;
  loans: LoansSection;
  assets: AssetsSection;
  retirement: RetirementSection | null;
}): NetWorth {
  const debts =
    sumHome(parts.credit.lines.map((l) => (l.owed_home === null ? null : Math.max(0, l.owed_home)))) + parts.loans.owed;
  const retirement = parts.retirement?.ready ? parts.retirement.funds : 0;
  const policyCash = parts.retirement?.ready ? parts.retirement.policy_cash_value : 0;
  const totalCents =
    cents(parts.cash.total) +
    cents(parts.bank.total) +
    cents(retirement) +
    cents(policyCash) +
    cents(parts.assets.total) -
    cents(debts);
  return {
    total: totalCents / 100,
    cash: parts.cash.total,
    bank: parts.bank.total,
    retirement: round2(retirement),
    policy_cash_value: round2(policyCash),
    assets: parts.assets.total,
    debts: round2(debts),
  };
}

/** The whole Wallet from loaded data. */
export function buildWallet(input: WalletInput): WalletView {
  const unconverted: UnconvertedItem[] = [];
  const cash = cashSection(input, unconverted);
  const bank = bankSection(input, unconverted);
  const credit = creditSection(input, unconverted);
  const loans = loansSection(input, unconverted);
  const assets = assetsSection(input);
  const retirement = retirementSection(input.retirement);
  return {
    today: input.today,
    home_currency: input.home,
    net_worth: netWorth({ cash, bank, credit, loans, assets, retirement }),
    cash,
    bank,
    credit,
    loans,
    assets,
    retirement,
    insurance: insuranceLine(input.policies, input.home),
    unconverted,
  };
}
