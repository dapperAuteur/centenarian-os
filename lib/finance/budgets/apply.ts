// lib/finance/budgets/apply.ts
// Which suggested budgets "Accept all suggestions" writes.
// No database access: tested in tests/unit/budgets.test.ts.

import type { BudgetLine } from './logic.ts';

export interface SuggestionWrite {
  category_id: string;
  amount: number;
}

/**
 * One write per category that has a suggestion different from its current
 * budget before carry-over, limited to `categoryIds` when given.
 */
export function suggestionsToApply(lines: BudgetLine[], categoryIds: string[] | null): SuggestionWrite[] {
  const only = categoryIds ? new Set(categoryIds) : null;
  return lines
    .filter((line) => !only || only.has(line.id))
    .filter((line) => line.suggestion.amount !== null && line.suggestion.amount !== line.base_budget)
    .map((line) => ({ category_id: line.id, amount: line.suggestion.amount as number }));
}
