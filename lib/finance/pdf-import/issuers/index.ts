// lib/finance/pdf-import/issuers/index.ts
// The issuer registry. Each parser says whether a statement looks like its
// layout; the first one that does reads it, and the generic parser takes
// anything else. Add an issuer by writing a parser next to citi-best-buy.ts
// and listing it in ISSUERS above the generic one.

import { citiBestBuy } from './citi-best-buy.ts';
import { generic } from './generic.ts';
import type { IssuerParser, ParsedStatement, PdfLine } from '../types.ts';

/** Recognized layouts, most specific first. The generic fallback is not in this list. */
export const ISSUERS: readonly IssuerParser[] = [citiBestBuy];

/** The parser for these lines: a recognized issuer, or the generic fallback. */
export function detectIssuer(lines: readonly PdfLine[]): IssuerParser {
  return ISSUERS.find((issuer) => issuer.detect(lines)) ?? generic;
}

export function parseStatementLines(lines: readonly PdfLine[]): ParsedStatement {
  return detectIssuer(lines).parse(lines);
}

/** Names of the recognized issuers, for help text. */
export const RECOGNIZED_ISSUER_LABELS: readonly string[] = ISSUERS.map((issuer) => issuer.label);
