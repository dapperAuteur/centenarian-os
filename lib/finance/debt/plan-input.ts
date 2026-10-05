// lib/finance/debt/plan-input.ts
// Validation for saved debt-free plans (POST/PATCH /api/finance/debt/saved-plans). Pure.

import { DEFAULT_STRATEGY, isStrategy } from './plan.ts';
import type { Strategy } from './plan.ts';

export const MAX_PLAN_NAME = 100;
export const MAX_EXTRA_MONTHLY = 1_000_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PlanInput {
  name: string;
  strategy: Strategy;
  extra_monthly: number;
  custom_order: string[];
  protect_promos: boolean;
}

export type PlanInputResult = { ok: true; value: Partial<PlanInput> } | { ok: false; error: string };

/**
 * Check a request body. With `partial` (PATCH) only the fields present are returned; otherwise
 * missing fields get defaults (avalanche, $0 extra, promos protected).
 */
export function parsePlanInput(body: unknown, partial = false): PlanInputResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Send the plan as JSON.' };
  const b = body as Record<string, unknown>;
  const out: Partial<PlanInput> = {};

  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim()) return { ok: false, error: 'Give the plan a name.' };
    if (b.name.trim().length > MAX_PLAN_NAME) return { ok: false, error: `Keep the name under ${MAX_PLAN_NAME} characters.` };
    out.name = b.name.trim();
  } else if (!partial) out.name = 'My debt-free plan';

  if (b.strategy !== undefined) {
    if (!isStrategy(b.strategy)) return { ok: false, error: 'Strategy must be avalanche, snowball, promo_first or custom.' };
    out.strategy = b.strategy;
  } else if (!partial) out.strategy = DEFAULT_STRATEGY;

  if (b.extra_monthly !== undefined) {
    const n = Number(b.extra_monthly);
    if (!Number.isFinite(n) || n < 0 || n > MAX_EXTRA_MONTHLY) {
      return { ok: false, error: 'Extra each month must be a dollar amount of 0 or more.' };
    }
    out.extra_monthly = Math.round(n * 100) / 100;
  } else if (!partial) out.extra_monthly = 0;

  if (b.custom_order !== undefined) {
    if (!Array.isArray(b.custom_order) || !b.custom_order.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
      return { ok: false, error: 'Custom order must be a list of account ids.' };
    }
    out.custom_order = [...new Set(b.custom_order as string[])].slice(0, 100);
  } else if (!partial) out.custom_order = [];

  if (b.protect_promos !== undefined) {
    if (typeof b.protect_promos !== 'boolean') return { ok: false, error: 'protect_promos must be true or false.' };
    out.protect_promos = b.protect_promos;
  } else if (!partial) out.protect_promos = true;

  return { ok: true, value: out };
}
