'use client';

// components/pricing/StarterModulePicker.tsx
// The 3-of-8 module picker for the Starter tier. Used in two contexts:
//
//   1. "new"  — a visitor or free user is about to start a Starter
//               subscription. Continue fires Stripe checkout with the
//               selected modules and billing cadence as metadata.
//   2. "swap" — an existing Starter subscriber wants to change their
//               three picks mid-cycle. Continue PATCHes
//               /api/user/starter-modules (no Stripe interaction).
//
// Owner decision §16.9: no billing-cycle restrictions, users can swap
// any time. No change history — the previous selection is simply
// overwritten.

import { useCallback, useMemo, useState } from 'react';
import {
  Briefcase, Dumbbell, DollarSign, HeartPulse, Navigation, Package,
  TrendingUp, Utensils,
  Check, Loader2, Lock, Sparkles, type LucideIcon,
} from 'lucide-react';
import {
  STARTER_MODULES,
  STARTER_MODULE_SLUGS,
  STARTER_PICK_LIMIT,
  isValidStarterSelection,
  type ModuleSlug,
} from '@/lib/access/starter-modules';

const ICON_MAP: Record<string, LucideIcon> = {
  Briefcase,
  Utensils,
  HeartPulse,
  Dumbbell,
  DollarSign,
  Navigation,
  Package,
  TrendingUp,
};

export type PickerMode = 'new' | 'swap';
export type BillingCadence = 'monthly' | 'annual';

export interface StarterModulePickerProps {
  mode: PickerMode;
  /** Prefilled selection (existing Starter user's current picks, or empty for new). */
  initialSelection?: string[];
  /** Prefilled cadence. Swap mode ignores this (cadence change happens in Stripe customer portal). */
  initialCadence?: BillingCadence;
  /** Fires with the final { slugs, cadence } when the user commits. */
  onSubmit: (selection: ModuleSlug[], cadence: BillingCadence) => Promise<void> | void;
  /** Fires when the user dismisses the picker. */
  onCancel: () => void;
  /** Error surface, e.g., "Stripe checkout failed — try again." */
  externalError?: string | null;
}

const MONTHLY_PRICE_DISPLAY = '$5.46';
const ANNUAL_PRICE_DISPLAY = '$51.80';
const ANNUAL_SAVINGS_PCT = 21;

export default function StarterModulePicker({
  mode,
  initialSelection = [],
  initialCadence = 'monthly',
  onSubmit,
  onCancel,
  externalError,
}: StarterModulePickerProps) {
  // Normalize the initial selection to valid ModuleSlug entries only.
  // Ignore unknown slugs (e.g., a legacy invite_module prefix accidentally
  // passed in) so the picker always starts from a clean state.
  const [picked, setPicked] = useState<ModuleSlug[]>(() =>
    initialSelection.filter((s): s is ModuleSlug => STARTER_MODULE_SLUGS.includes(s as ModuleSlug)),
  );
  const [cadence, setCadence] = useState<BillingCadence>(initialCadence);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const isFull = picked.length >= STARTER_PICK_LIMIT;
  const isValid = isValidStarterSelection(picked);

  const toggle = useCallback((slug: ModuleSlug) => {
    setError(null);
    setPicked((current) => {
      if (current.includes(slug)) {
        return current.filter((s) => s !== slug);
      }
      if (current.length >= STARTER_PICK_LIMIT) {
        setError(`You can pick ${STARTER_PICK_LIMIT} modules — uncheck one to choose a different module.`);
        return current;
      }
      return [...current, slug];
    });
  }, []);

  async function handleSubmit() {
    if (!isValid) {
      setError(`Choose exactly ${STARTER_PICK_LIMIT} modules to continue.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(picked, cadence);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
    // Intentionally not resetting submitting on success — the caller
    // typically navigates away, and flipping back creates a visual blip.
  }

  const displayError = error ?? externalError ?? null;

  return (
    <div className="space-y-5">
      {/* Billing cadence toggle — hidden in swap mode (cadence changes
          happen via Stripe customer portal, not the picker). */}
      {mode === 'new' && (
        <fieldset className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
          <legend className="sr-only">Billing cadence</legend>
          <label
            className={`cursor-pointer rounded-lg px-3 py-3 text-center transition ${
              cadence === 'monthly'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <input
              type="radio"
              name="starter-cadence"
              value="monthly"
              checked={cadence === 'monthly'}
              onChange={() => setCadence('monthly')}
              className="sr-only"
            />
            <span className="block text-xs uppercase tracking-wide font-semibold mb-0.5">Monthly</span>
            <span className="block text-base font-bold">{MONTHLY_PRICE_DISPLAY}<span className="text-xs font-normal text-gray-500">/mo</span></span>
          </label>
          <label
            className={`cursor-pointer rounded-lg px-3 py-3 text-center transition relative ${
              cadence === 'annual'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <input
              type="radio"
              name="starter-cadence"
              value="annual"
              checked={cadence === 'annual'}
              onChange={() => setCadence('annual')}
              className="sr-only"
            />
            <span className="absolute -top-1.5 right-2 bg-lime-500 text-gray-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Save {ANNUAL_SAVINGS_PCT}%
            </span>
            <span className="block text-xs uppercase tracking-wide font-semibold mb-0.5">Annual</span>
            <span className="block text-base font-bold">{ANNUAL_PRICE_DISPLAY}<span className="text-xs font-normal text-gray-500">/yr</span></span>
          </label>
        </fieldset>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Pick {STARTER_PICK_LIMIT} modules
        </h3>
        <span
          className={`text-sm font-semibold ${
            picked.length === STARTER_PICK_LIMIT ? 'text-fuchsia-600' : 'text-gray-500'
          }`}
          aria-live="polite"
        >
          {picked.length} / {STARTER_PICK_LIMIT}
        </span>
      </div>

      <p className="text-xs text-gray-500 -mt-3">
        Planner, Roadmap, Academy, Life Categories, and Data Hub are always included for every tier — no need to pick them.
      </p>

      <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {STARTER_MODULE_SLUGS.map((slug) => {
          const mod = STARTER_MODULES[slug];
          const checked = pickedSet.has(slug);
          const disabled = !checked && isFull;
          const Icon = ICON_MAP[mod.icon] ?? Sparkles;
          return (
            <li key={slug}>
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition min-h-[68px] ${
                  checked
                    ? 'border-fuchsia-500 bg-fuchsia-50'
                    : disabled
                      ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(slug)}
                  disabled={disabled}
                  className="sr-only"
                  aria-describedby={`mod-${slug}-desc`}
                />
                <span
                  className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                    checked ? 'bg-fuchsia-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                  aria-hidden="true"
                >
                  {checked ? <Check className="w-5 h-5" /> : disabled ? <Lock className="w-4 h-4" /> : <Icon className="w-5 h-5" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{mod.label}</span>
                  <span id={`mod-${slug}-desc`} className="block text-xs text-gray-500 mt-0.5 leading-snug">
                    {mod.description}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {displayError && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {displayError}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="min-h-11 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="min-h-11 px-5 py-2 text-sm font-semibold bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 justify-center"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              {mode === 'swap' ? 'Saving…' : 'Redirecting…'}
            </>
          ) : mode === 'swap' ? (
            'Save changes'
          ) : cadence === 'annual' ? (
            `Continue — ${ANNUAL_PRICE_DISPLAY}/yr`
          ) : (
            `Continue — ${MONTHLY_PRICE_DISPLAY}/mo`
          )}
        </button>
      </div>
    </div>
  );
}
