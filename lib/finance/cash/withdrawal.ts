// lib/finance/cash/withdrawal.ts
// Which bank statement rows are cash taken out of the account: an ATM
// withdrawal, cash handed over at a branch or by a teller, or cash back given
// as its own line. The statement import offers those rows "Cash withdrawal ->
// into <cash account>", so the cash lands in a cash account as a transfer
// instead of counting as spending (lib/finance/csv-import/card-terms.ts).
//
// Wording rules (tested against the description lowercased, with every
// character that isn't a-z or 0-9 turned into a space, the same text
// transferHints() reads, so "ATM W/D" reads "atm w d" and "CAJERO AUTOMÁTICO"
// reads "cajero autom tico"):
//   cash out:  "atm"; "cash withdrawal" / "cash wd" / "cash w d" / "cash
//              disbursement"; "withdrawal cash" / "withdrawal at branch" /
//              "withdrawal at atm"; "branch withdrawal" / "teller withdrawal" /
//              "counter withdrawal"; Spanish "retiro" (retiro en cajero, retiro
//              de efectivo), "cajero", "disposicion de efectivo"; and "cash back"
//              as a line of its own.
//   never:     fees and their kin (fee, surcharge, charge, comision, iva,
//              cargo), money coming back (rebate, refund, reimbursement,
//              reversal), deposits, purchases (purchase, pos, compra: an "ATM
//              card" purchase, or a purchase that includes cash back, is
//              spending), and Spanish transfers or debits that also say retiro
//              (spei, transferencia, domiciliacion, cheque).
// So "ATM FEE" or "COMISION RETIRO CAJERO" stays an ordinary expense.
//
// Pure: no React, no network. Relative imports end in `.ts` for
// `node --test --experimental-strip-types` (tests/unit/cash.test.ts).

/** The text the rules read: lowercased, everything but a-z and 0-9 turned into spaces. */
export function withdrawalText(description: string | null | undefined): string {
  return ` ${(description ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

const CASH_OUT: readonly RegExp[] = [
  /\batm\b/,
  /\bcash (?:withdrawal|withdrawl|withdraw|wdl?|w d|disbursement)\b/,
  /\bwithdrawal (?:cash|at branch|at the branch|at atm|at teller|teller|branch)\b/,
  /\b(?:branch|teller|counter|over the counter) withdrawal\b/,
  /\bretiro\b/,
  /\bcajero\b/,
  /\bdisp(?:osici n|osicion)? (?:de )?efectivo\b/,
];

/** "Cash back" given as its own line (not a purchase that includes it, not card rewards). */
const CASH_BACK = /\bcash ?back\b/;
const NOT_CASH_BACK = /\b(?:with|reward|rewards|bonus|redemption|redeem|redeemed|earned|statement credit)\b/;

const NEVER = /\b(?:fees?|surcharge|charge|charges|rebate|refund|reimburse\w*|reversal|reversed|deposit|purchase|pos|compra|comisi\w*|iva|cargo|spei|transferencia|transfer|domiciliaci\w*|cheque|check)\b/;

/** True when a statement row's wording means cash was taken out (see the rules above). */
export function isCashWithdrawalText(description: string | null | undefined): boolean {
  const text = withdrawalText(description);
  if (text.trim() === '') return false;
  if (NEVER.test(text)) return false;
  if (CASH_OUT.some((pattern) => pattern.test(text))) return true;
  return CASH_BACK.test(text) && !NOT_CASH_BACK.test(text);
}
