// lib/finance/invoice-references.ts
// The foreign ids an invoice or invoice template carries.
//
// Invoices and templates are written with the service-role client, and their
// ids are copied onto financial transactions when an invoice is paid or made
// from a template, then read back through joins. Each id must be the caller's
// own. Check a request body with checkReferences(); re-check ids saved before
// these checks existed with usableReferences() before copying them.
//
// Kept free of '@/' imports so node --test can load it.

import { referencesIn, type Reference, type ReferenceField } from '../auth/ownership.ts';

export const INVOICE_REFERENCE_FIELDS: readonly ReferenceField[] = [
  { field: 'contact_id', table: 'user_contacts' },
  { field: 'account_id', table: 'financial_accounts' },
  { field: 'brand_id', table: 'user_brands' },
  { field: 'category_id', table: 'budget_categories' },
  { field: 'job_id', table: 'contractor_jobs' },
];

/** The references an invoice or template body (or a saved row) carries. */
export function invoiceReferences(body: unknown): Reference[] {
  return referencesIn(body, INVOICE_REFERENCE_FIELDS);
}
