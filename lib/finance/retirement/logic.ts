// lib/finance/retirement/logic.ts
// Pure math for the retirement planner (plans/61 §4). Every figure it produces is an ESTIMATE from
// the person's own inputs and the assumptions below, not a forecast and not financial advice. The
// help article "The retirement planner and its assumptions" says the same in plain words.
//
// RULES
//
//   Contributions (per account, per year)
//     - 'amount': contribution_amount x pay periods per year (weekly 52, biweekly 26,
//       semimonthly 24, monthly 12, quarterly 4, annually 1).
//     - 'percent': contribution_percent % of annual_pay (0 without a pay figure).
//     - Employer match: match_rate_percent % of what you put in, counting only contributions up to
//       match_limit_percent % of annual_pay, at most match_annual_cap a year. With a limit but no pay
//       figure the match can't be worked out: it counts as 0 and the account is flagged.
//     - Contributions stay flat in dollars until retirement (no raises assumed), added at the end of
//       each month as one twelfth of the yearly total.
//
//   Growth
//     - Monthly compounding at the monthly equivalent of the yearly return:
//       r_m = (1 + r)^(1/12) - 1. Balance after n months = B (1 + r_m)^n + C ((1 + r_m)^n - 1) / r_m.
//     - Returns are nominal (before inflation). "Today's dollars" (real) = nominal / (1 + i)^years.
//     - Presets (assumptions, editable, not sourced figures): conservative 4%, middle 6%,
//       optimistic 8% a year nominal; inflation 3% a year.
//     - "Your plan": each account at its own expected return when set, else the selected preset.
//       The three preset lines apply one rate to every account so they compare like for like.
//
//   Target (in today's dollars)
//     - Yearly spending in retirement = the amount entered, or a multiple (default 1x) of current
//       yearly spending (the average month of spending history x 12).
//     - Social Security (typed in by hand, monthly, today's dollars) lowers the yearly need from its
//       start age (default: the retirement age).
//     - 'years': sum over each year from retirement age to life expectancy of
//       spending - Social Security (from its start age), never below 0. No growth during
//       retirement is assumed, which keeps the figure simple.
//     - 'withdrawal_rate' (a rule of thumb often called the 4% rule, not a guarantee):
//       (spending - Social Security) / withdrawal rate, plus the Social Security amount for each
//       year between retirement and its start age (the "bridge" years).
//     - Social Security offset = the target without Social Security minus the target with it.
//
//   Gap and "needed per month"
//     - Gap = target - projected balance in today's dollars ("your plan"). Above 0 = short.
//     - Extra needed per month = the monthly deposit that grows to the gap by retirement at the
//       selected preset's real return: gap x r / ((1 + r)^n - 1) (gap / n when r = 0).
//     - At or past retirement age there is no "per month" figure.
//
// Imports nothing at runtime, so it runs under `node --test --experimental-strip-types`
// (tests/unit/retirement.test.ts).

// ── Kinds and labels ─────────────────────────────────────────────────────────

export const ACCOUNT_KINDS = [
  '401k',
  '403b',
  '457b',
  'traditional_ira',
  'roth_ira',
  'sep_ira',
  'simple_ira',
  'hsa',
  'brokerage',
  'pension',
  'annuity',
  'whole_life_cash_value',
  'other',
] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  '401k': '401(k)',
  '403b': '403(b)',
  '457b': '457(b)',
  traditional_ira: 'Traditional IRA',
  roth_ira: 'Roth IRA',
  sep_ira: 'SEP IRA',
  simple_ira: 'SIMPLE IRA',
  hsa: 'HSA',
  brokerage: 'Brokerage',
  pension: 'Pension',
  annuity: 'Annuity',
  whole_life_cash_value: 'Whole life cash value',
  other: 'Other',
};

export const CONTRIBUTION_TYPES = ['none', 'amount', 'percent'] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

export const PERIODS_PER_YEAR = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  quarterly: 4,
  annually: 1,
} as const;
export type ContributionFrequency = keyof typeof PERIODS_PER_YEAR;
export const CONTRIBUTION_FREQUENCIES = Object.keys(PERIODS_PER_YEAR) as ContributionFrequency[];

export const FREQUENCY_LABEL: Record<ContributionFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  semimonthly: 'Twice a month',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Yearly',
};

export const PRESETS = ['conservative', 'middle', 'optimistic'] as const;
export type Preset = (typeof PRESETS)[number];
export const PRESET_LABEL: Record<Preset, string> = {
  conservative: 'Conservative',
  middle: 'Middle',
  optimistic: 'Optimistic',
};

export type SpendingMode = 'amount' | 'multiple';
export type TargetMethod = 'years' | 'withdrawal_rate';

/** Assumptions used when the person hasn't set their own. Not sourced figures: editable defaults. */
export const DEFAULTS = {
  retirement_age: 65,
  life_expectancy: 90,
  inflation_rate: 3,
  return_conservative: 4,
  return_middle: 6,
  return_optimistic: 8,
  withdrawal_rate: 4,
  spending_multiple: 1,
} as const;

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

// ── Numbers ──────────────────────────────────────────────────────────────────

export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Contributions and match ─────────────────────────────────────────────────

export interface ContributionInput {
  contribution_type: string;
  contribution_amount: number | string | null;
  contribution_percent: number | string | null;
  contribution_frequency: string;
  annual_pay: number | string | null;
  match_rate_percent: number | string | null;
  match_limit_percent: number | string | null;
  match_annual_cap: number | string | null;
}

/** What the person puts in each year. */
export function annualContribution(a: ContributionInput): number {
  if (a.contribution_type === 'amount') {
    const amount = num(a.contribution_amount) ?? 0;
    const periods = isOneOf(CONTRIBUTION_FREQUENCIES, a.contribution_frequency)
      ? PERIODS_PER_YEAR[a.contribution_frequency]
      : 12;
    return round2(Math.max(0, amount) * periods);
  }
  if (a.contribution_type === 'percent') {
    const pct = num(a.contribution_percent) ?? 0;
    const pay = num(a.annual_pay) ?? 0;
    return round2((Math.max(0, pct) / 100) * Math.max(0, pay));
  }
  return 0;
}

export interface MatchResult {
  amount: number;
  /** True when a match limit is set as a percent of pay but no pay figure was given. */
  needs_pay: boolean;
}

/** What the employer adds each year under the match rule. */
export function annualMatch(a: ContributionInput): MatchResult {
  const rate = num(a.match_rate_percent);
  if (rate === null || rate <= 0) return { amount: 0, needs_pay: false };
  const yours = annualContribution(a);
  const limitPct = num(a.match_limit_percent);
  const pay = num(a.annual_pay);
  let matchable = yours;
  if (limitPct !== null) {
    if (pay === null || pay <= 0) return { amount: 0, needs_pay: true };
    matchable = Math.min(yours, (limitPct / 100) * pay);
  }
  let amount = matchable * (rate / 100);
  const cap = num(a.match_annual_cap);
  if (cap !== null && cap >= 0) amount = Math.min(amount, cap);
  return { amount: round2(Math.max(0, amount)), needs_pay: false };
}

/** "100% up to 4% of pay, max $5,000/yr" style summary, or null with no match. */
export function matchSummary(a: ContributionInput): string | null {
  const rate = num(a.match_rate_percent);
  if (rate === null || rate <= 0) return null;
  const limit = num(a.match_limit_percent);
  const cap = num(a.match_annual_cap);
  let text = `${trimNum(rate)}% match`;
  if (limit !== null) text += ` up to ${trimNum(limit)}% of pay`;
  if (cap !== null) text += `, at most ${cap.toLocaleString('en-US', { maximumFractionDigits: 0 })} a year`;
  return text;
}

function trimNum(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

// ── Growth ───────────────────────────────────────────────────────────────────

/** Monthly rate equivalent to a yearly percent. */
export function monthlyRate(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

/** Real (after inflation) yearly percent from a nominal one. */
export function realRatePct(nominalPct: number, inflationPct: number): number {
  return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
}

/** Balance after `months` of growth at `annualPct` with `monthly` added at each month's end. */
export function futureValue(start: number, monthly: number, annualPct: number, months: number): number {
  if (months <= 0) return start;
  const r = monthlyRate(annualPct);
  if (Math.abs(r) < 1e-12) return start + monthly * months;
  const g = Math.pow(1 + r, months);
  return start * g + monthly * ((g - 1) / r);
}

/** Nominal -> today's dollars after `years`. */
export function toReal(nominal: number, inflationPct: number, years: number): number {
  return nominal / Math.pow(1 + inflationPct / 100, years);
}

/** Monthly deposit that grows to `amount` in `months` at `annualPct`. 0 when nothing is needed. */
export function monthlyToReach(amount: number, annualPct: number, months: number): number | null {
  if (amount <= 0) return 0;
  if (months <= 0) return null;
  const r = monthlyRate(annualPct);
  if (Math.abs(r) < 1e-12) return amount / months;
  return (amount * r) / (Math.pow(1 + r, months) - 1);
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface SettingsRow {
  birth_year?: number | string | null;
  current_age?: number | string | null;
  retirement_age?: number | string | null;
  life_expectancy?: number | string | null;
  spending_mode?: string | null;
  desired_yearly_spending?: number | string | null;
  spending_multiple?: number | string | null;
  social_security_monthly?: number | string | null;
  social_security_start_age?: number | string | null;
  inflation_rate?: number | string | null;
  return_conservative?: number | string | null;
  return_middle?: number | string | null;
  return_optimistic?: number | string | null;
  selected_preset?: string | null;
  target_method?: string | null;
  withdrawal_rate?: number | string | null;
}

export interface ResolvedSettings {
  current_age: number | null;
  retirement_age: number;
  life_expectancy: number;
  spending_mode: SpendingMode;
  desired_yearly_spending: number | null;
  spending_multiple: number;
  social_security_monthly: number;
  social_security_start_age: number;
  inflation_rate: number;
  returns: Record<Preset, number>;
  selected_preset: Preset;
  target_method: TargetMethod;
  withdrawal_rate: number;
  /** Names of the inputs filled with an app default (shown as "assumed" on the page). */
  defaulted: string[];
}

/** Age from birth year (calendar year of `today`) when given, else the typed age. */
export function ageFrom(row: SettingsRow, today: string): number | null {
  const birth = num(row.birth_year);
  if (birth !== null) return Number(today.slice(0, 4)) - birth;
  return num(row.current_age);
}

export function resolveSettings(row: SettingsRow | null, today: string): ResolvedSettings {
  const r = row ?? {};
  const defaulted: string[] = [];
  const pick = (key: keyof typeof DEFAULTS, value: unknown): number => {
    const n = num(value);
    if (n === null) {
      defaulted.push(key);
      return DEFAULTS[key];
    }
    return n;
  };
  const retirement_age = pick('retirement_age', r.retirement_age);
  return {
    current_age: ageFrom(r, today),
    retirement_age,
    life_expectancy: pick('life_expectancy', r.life_expectancy),
    spending_mode: r.spending_mode === 'multiple' ? 'multiple' : 'amount',
    desired_yearly_spending: num(r.desired_yearly_spending),
    spending_multiple: pick('spending_multiple', r.spending_multiple),
    social_security_monthly: Math.max(0, num(r.social_security_monthly) ?? 0),
    social_security_start_age: num(r.social_security_start_age) ?? retirement_age,
    inflation_rate: pick('inflation_rate', r.inflation_rate),
    returns: {
      conservative: pick('return_conservative', r.return_conservative),
      middle: pick('return_middle', r.return_middle),
      optimistic: pick('return_optimistic', r.return_optimistic),
    },
    selected_preset: isOneOf(PRESETS, r.selected_preset) ? r.selected_preset : 'middle',
    target_method: r.target_method === 'withdrawal_rate' ? 'withdrawal_rate' : 'years',
    withdrawal_rate: pick('withdrawal_rate', r.withdrawal_rate),
    defaulted,
  };
}

// ── Target ───────────────────────────────────────────────────────────────────

export interface TargetResult {
  /** Yearly spending in retirement, today's dollars. Null when it can't be worked out. */
  yearly_spending: number | null;
  social_security_yearly: number;
  years_in_retirement: number;
  /** Amount needed at retirement, today's dollars. Null without a spending figure. */
  target: number | null;
  /** How much Social Security lowers the target. */
  social_security_offset: number;
  method: TargetMethod;
}

/** Yearly spending in retirement from the settings and current yearly spending (may be null). */
export function retirementSpending(s: ResolvedSettings, currentYearlySpending: number | null): number | null {
  if (s.spending_mode === 'amount') return s.desired_yearly_spending;
  if (currentYearlySpending === null) return null;
  return round2(currentYearlySpending * s.spending_multiple);
}

function targetFor(s: ResolvedSettings, spending: number, ssYearly: number): number {
  const years = Math.max(0, s.life_expectancy - s.retirement_age);
  const bridge = Math.min(years, Math.max(0, s.social_security_start_age - s.retirement_age));
  if (s.target_method === 'withdrawal_rate') {
    const rate = s.withdrawal_rate > 0 ? s.withdrawal_rate / 100 : DEFAULTS.withdrawal_rate / 100;
    return Math.max(0, spending - ssYearly) / rate + bridge * Math.min(ssYearly, spending);
  }
  return bridge * spending + (years - bridge) * Math.max(0, spending - ssYearly);
}

export function retirementTarget(s: ResolvedSettings, currentYearlySpending: number | null): TargetResult {
  const spending = retirementSpending(s, currentYearlySpending);
  const ssYearly = round2(s.social_security_monthly * 12);
  const years = Math.max(0, s.life_expectancy - s.retirement_age);
  if (spending === null) {
    return { yearly_spending: null, social_security_yearly: ssYearly, years_in_retirement: years, target: null, social_security_offset: 0, method: s.target_method };
  }
  const withSs = targetFor(s, spending, ssYearly);
  const withoutSs = targetFor(s, spending, 0);
  return {
    yearly_spending: spending,
    social_security_yearly: ssYearly,
    years_in_retirement: years,
    target: round2(withSs),
    social_security_offset: round2(withoutSs - withSs),
    method: s.target_method,
  };
}

// ── The plan ─────────────────────────────────────────────────────────────────

export interface PlanAccount {
  id: string;
  name: string;
  /** Latest balance in the home currency (0 with no snapshot). */
  balance: number;
  /** Yours + employer match, per year, home currency. */
  annual_contribution: number;
  annual_match: number;
  /** The account's own expected return (nominal %), or null to use the selected preset. */
  expected_return: number | null;
  is_active: boolean;
}

export interface SeriesPoint {
  age: number;
  year: number;
  /** Today's dollars per line. */
  yours: number;
  conservative: number;
  middle: number;
  optimistic: number;
}

export interface AccountProjection {
  id: string;
  rate: number;
  rate_source: 'account' | 'preset';
  nominal: number;
  real: number;
}

export interface PlanResult {
  years_to_retirement: number | null;
  months_to_retirement: number | null;
  retired: boolean;
  current_total: number;
  monthly_contributions: number;
  /** "Your plan" at retirement. */
  projected_nominal: number | null;
  projected_real: number | null;
  /** Each preset applied to every account, at retirement, today's dollars. */
  preset_real: Record<Preset, number> | null;
  accounts: AccountProjection[];
  series: SeriesPoint[];
  target: TargetResult;
  /** target - projected_real (today's dollars); above 0 = short. */
  gap: number | null;
  /** Extra per month to close the gap at the selected preset's real return. */
  extra_monthly_needed: number | null;
  /** Current contributions + extra. */
  total_monthly_needed: number | null;
  selected_real_return: number;
}

export interface PlanInput {
  accounts: PlanAccount[];
  settings: ResolvedSettings;
  currentYearlySpending: number | null;
  today: string;
}

export function buildPlan(input: PlanInput): PlanResult {
  const s = input.settings;
  const active = input.accounts.filter((a) => a.is_active);
  const current_total = round2(input.accounts.reduce((sum, a) => sum + a.balance, 0));
  const monthlyOf = (a: PlanAccount) => (a.annual_contribution + a.annual_match) / 12;
  const monthly_contributions = round2(active.reduce((sum, a) => sum + monthlyOf(a), 0));
  const target = retirementTarget(s, input.currentYearlySpending);
  const selectedRate = s.returns[s.selected_preset];
  const selected_real_return = round2(realRatePct(selectedRate, s.inflation_rate) * 1000) / 1000;

  const age = s.current_age;
  const years = age === null ? null : Math.max(0, s.retirement_age - age);
  const months = years === null ? null : years * 12;
  const retired = years === 0;

  // Inactive accounts keep their balance and grow, but get no new contributions.
  const grow = (a: PlanAccount, rate: number, m: number) => futureValue(a.balance, a.is_active ? monthlyOf(a) : 0, rate, m);
  const ownRate = (a: PlanAccount) => (a.expected_return ?? selectedRate);

  if (months === null || years === null || age === null) {
    return {
      years_to_retirement: null,
      months_to_retirement: null,
      retired: false,
      current_total,
      monthly_contributions,
      projected_nominal: null,
      projected_real: null,
      preset_real: null,
      accounts: input.accounts.map((a) => ({
        id: a.id,
        rate: ownRate(a),
        rate_source: a.expected_return === null ? 'preset' : 'account',
        nominal: a.balance,
        real: a.balance,
      })),
      series: [],
      target,
      gap: null,
      extra_monthly_needed: null,
      total_monthly_needed: null,
      selected_real_return,
    };
  }

  const accounts: AccountProjection[] = input.accounts.map((a) => {
    const rate = ownRate(a);
    const nominal = grow(a, rate, months);
    return {
      id: a.id,
      rate,
      rate_source: a.expected_return === null ? 'preset' : 'account',
      nominal: round2(nominal),
      real: round2(toReal(nominal, s.inflation_rate, years)),
    };
  });
  const projected_nominal = round2(accounts.reduce((sum, a) => sum + a.nominal, 0));
  const projected_real = round2(toReal(projected_nominal, s.inflation_rate, years));

  const totalAt = (m: number, rateFor: (a: PlanAccount) => number) =>
    input.accounts.reduce((sum, a) => sum + grow(a, rateFor(a), m), 0);
  const preset_real = {
    conservative: round2(toReal(totalAt(months, () => s.returns.conservative), s.inflation_rate, years)),
    middle: round2(toReal(totalAt(months, () => s.returns.middle), s.inflation_rate, years)),
    optimistic: round2(toReal(totalAt(months, () => s.returns.optimistic), s.inflation_rate, years)),
  };

  const startYear = Number(input.today.slice(0, 4));
  const series: SeriesPoint[] = [];
  for (let y = 0; y <= years; y++) {
    const m = y * 12;
    const real = (n: number) => round2(toReal(n, s.inflation_rate, y));
    series.push({
      age: age + y,
      year: startYear + y,
      yours: real(totalAt(m, ownRate)),
      conservative: real(totalAt(m, () => s.returns.conservative)),
      middle: real(totalAt(m, () => s.returns.middle)),
      optimistic: real(totalAt(m, () => s.returns.optimistic)),
    });
  }

  const gap = target.target === null ? null : round2(target.target - projected_real);
  let extra: number | null = null;
  if (gap !== null && !retired) {
    const need = monthlyToReach(gap, selected_real_return, months);
    extra = need === null ? null : round2(need);
  }
  return {
    years_to_retirement: years,
    months_to_retirement: months,
    retired,
    current_total,
    monthly_contributions,
    projected_nominal,
    projected_real,
    preset_real,
    accounts,
    series,
    target,
    gap,
    extra_monthly_needed: extra,
    total_monthly_needed: extra === null ? null : round2(monthly_contributions + extra),
    selected_real_return,
  };
}

// ── Snapshots ────────────────────────────────────────────────────────────────

export interface SnapshotRow {
  account_id: string;
  as_of: string;
  balance: number | string;
  contributions_ytd?: number | string | null;
}

/** Latest snapshot per account (by as_of). */
export function latestSnapshots<T extends SnapshotRow>(rows: readonly T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const row of rows) {
    const seen = out.get(row.account_id);
    if (!seen || row.as_of > seen.as_of) out.set(row.account_id, row);
  }
  return out;
}
