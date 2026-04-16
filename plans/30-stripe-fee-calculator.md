# Plan 30 — Live Stripe Fee Calculator on Price Inputs

> **Status:** Backlog. No code yet.
> **Source:** owner request 2026-04-16 — "show fee breakdown as user types".
> **Effort:** small (~1–2 hrs).

---

## 1. Context

Every surface where a user sets a product price (course price in the teacher editor, Starter tier amounts in admin-facing configs, invoice line items if we ever expose those) should show the Stripe breakdown live. US standard card rate is **2.9% + $0.30 per transaction**. Owner prices every product net-of-fees; this calculator turns the "what do I actually receive" math from a mental exercise into a visible number.

## 2. Scope

**In scope:**
- New shared component `components/ui/StripeFeeBreakdown.tsx` that takes `{ amount: number }` (in dollars) and renders a three-line breakdown:
  - Customer pays: $X.XX
  - Stripe fee: $X.XX (2.9% + $0.30)
  - You receive: $X.XX
- Live-updating — rerenders as the user types.
- Handle edge cases: `amount ≤ 0` → "Free — no Stripe fee"; non-numeric → hide breakdown; very small amounts where fee > price → highlight in red with "You'd lose money on this price".
- Mount points:
  - Teacher course editor — `components/academy/course-editor/CourseInfoTab.tsx` (next to the price input)
  - Any future product-pricing surface (starter tier admin config if we add one, invoice line items, etc.)

**Out of scope:**
- International card rates (3.9% + $0.30 for non-US cards, Stripe Connect fees, etc.) — if the owner later ships to non-US markets, this is a follow-up.
- Applying the fee math to the Stripe Connect application_fee_amount calculation — that's a separate concern already handled server-side.

## 3. Design

```tsx
// components/ui/StripeFeeBreakdown.tsx
interface Props { amount: number; /** dollars */ }
export function StripeFeeBreakdown({ amount }: Props) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const fee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
  const net = Math.round((amount - fee) * 100) / 100;
  const loss = net <= 0;
  return (
    <dl aria-live="polite" className="text-xs text-gray-500 space-y-0.5 mt-1">
      <div><dt className="inline">Customer pays:</dt> <dd className="inline">${amount.toFixed(2)}</dd></div>
      <div><dt className="inline">Stripe fee (2.9% + $0.30):</dt> <dd className="inline text-amber-600">−${fee.toFixed(2)}</dd></div>
      <div className={loss ? 'text-red-600 font-semibold' : 'text-gray-700 font-semibold'}>
        <dt className="inline">You receive:</dt> <dd className="inline">${net.toFixed(2)}</dd>
        {loss && <span className="ml-2">⚠ fee exceeds price</span>}
      </div>
    </dl>
  );
}
```

No hooks, no network, no state. Pure function of the `amount` prop.

## 4. Integration sites

Search for every `<input>` that sets a dollar price:

- `components/academy/course-editor/CourseInfoTab.tsx` — course price input (paid courses)
- `components/academy/course-editor/CurriculumTab.tsx` — per-lesson/module pricing if it exists
- Any invoice form at `app/dashboard/finance/invoices/*`

For each, render `<StripeFeeBreakdown amount={parseFloat(priceInput) || 0} />` directly below the input.

## 5. Verification

1. Teacher sets course price to $10 → breakdown shows pays $10 / fee $0.59 / receives $9.41.
2. Teacher sets price to $0.30 → breakdown shows fee $0.31 / receives -$0.01 / red warning.
3. Teacher clears price → breakdown disappears.
4. Accessible: `aria-live="polite"` so screen readers announce the recalculation.

## 6. Open questions

- Should the calculator also show the annual-cycle projection ("your monthly × 12 = $X.XX; Stripe fees over a year = $Y.YY")? Probably over-engineered for v1.
- Should we bake in the **Stripe Connect** platform fee (for teacher payouts) separately? Different model — that fee is ours, not Stripe's, and the teacher's "take-home" is price - Stripe fee - platform fee. Worth a separate `TeacherPayoutBreakdown` component if we ship this for teachers.
