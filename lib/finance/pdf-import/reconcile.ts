// lib/finance/pdf-import/reconcile.ts
// Checks that a statement adds up before its rows are imported. Pure.
//
// Card statements (all amounts positive, as StatementFacts stores them):
//   previous balance - payments - credits + purchases + cash advances + fees + interest = new balance
// and, for each kind the summary prints, the parsed rows of that kind must
// add up to the summary's total:
//   payments  = sum of payment rows       credits   = sum of credit rows
//   purchases = sum of purchase rows      cash adv. = sum of cash advance rows
//   fees      = sum of fee rows           interest  = sum of interest rows
// Any difference, even one cent, fails the check.
//
// Relative imports end in `.ts` so tests/unit/pdf-import.test.ts can load this
// file under `node --test --experimental-strip-types`.

import type {
  ParsedStatement,
  Reconciliation,
  ReconciliationDifference,
  StatementFacts,
  StatementRow,
  StatementRowKind,
} from './types.ts';

const KIND_CHECKS: readonly { check: string; kind: StatementRowKind; fact: keyof StatementFacts; label: string }[] = [
  { check: 'payments', kind: 'payment', fact: 'payments', label: 'Payments in the summary vs. payment rows found' },
  { check: 'credits', kind: 'credit', fact: 'credits', label: 'Other credits in the summary vs. credit rows found' },
  { check: 'purchases', kind: 'purchase', fact: 'purchases', label: 'Purchases in the summary vs. purchase rows found' },
  { check: 'cash_advances', kind: 'cash_advance', fact: 'cashAdvances', label: 'Cash advances in the summary vs. cash advance rows found' },
  { check: 'fees', kind: 'fee', fact: 'fees', label: 'Fees in the summary vs. fee rows found' },
  { check: 'interest', kind: 'interest', fact: 'interestCharged', label: 'Interest in the summary vs. interest rows found' },
];

/** previous - payments - credits + purchases + cash advances + fees + interest, or null without a previous balance. */
export function expectedNewBalance(facts: StatementFacts): number | null {
  if (facts.previousBalance === null) return null;
  return (
    facts.previousBalance -
    (facts.payments ?? 0) -
    (facts.credits ?? 0) +
    (facts.purchases ?? 0) +
    (facts.cashAdvances ?? 0) +
    (facts.fees ?? 0) +
    (facts.interestCharged ?? 0)
  );
}

export function sumByKind(rows: readonly StatementRow[], kind: StatementRowKind): number {
  return rows.reduce((total, row) => (row.kind === kind ? total + row.amountCents : total), 0);
}

export function reconcileStatement(parsed: Pick<ParsedStatement, 'rows' | 'statement'>): Reconciliation {
  const facts = parsed.statement;
  const differences: ReconciliationDifference[] = [];

  const expected = expectedNewBalance(facts);
  const checked = expected !== null && facts.newBalance !== null;
  if (checked && expected !== facts.newBalance) {
    differences.push({
      check: 'balance',
      label: 'New balance worked out from the summary vs. the new balance printed',
      expected: expected as number,
      actual: facts.newBalance as number,
      difference: (facts.newBalance as number) - (expected as number),
    });
  }

  for (const { check, kind, fact, label } of KIND_CHECKS) {
    const total = facts[fact];
    if (typeof total !== 'number') continue;
    const found = sumByKind(parsed.rows, kind);
    if (found !== total) {
      differences.push({ check, label, expected: total, actual: found, difference: found - total });
    }
  }

  return { ok: checked && differences.length === 0, checked, differences };
}
