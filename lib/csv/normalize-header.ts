// lib/csv/normalize-header.ts
// The one way CSV column headers are turned into keys, shared by every importer
// so a header matches no matter how the file capitalizes or spaces it.

/** `Transaction Date` / ` transaction  date ` -> `transaction_date`. Punctuation is kept: `Amount (USD)` -> `amount_(usd)`. */
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}
