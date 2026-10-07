// lib/finance/bulk-edit/remember.ts
// "Remember for future imports" after a bulk edit: saves a vendor's learned
// category, the same rule the "Always categorize this vendor as ...?" prompt
// saves (POST /api/finance/learned-categories). The rule lives on the vendor's
// saved contact (user_contacts.default_category_id); every contact whose name
// normalizes to the same vendor key gets it, or a contact is created.
//
// The statement import, receipt scans and new transactions then file this
// vendor's transactions under the category (lib/finance/learned-categories.ts).
// No '@/' imports: runs under node --test (tests/unit/bulk-edit.test.ts).

import { contactTypeForTransaction, vendorKey } from '../transaction-matching.ts';

/** The client this file needs (see OwnershipDb for why `from` returns any). */
export interface RememberDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

/** Saved contacts read per lookup, as the learned-categories route reads them. */
const CONTACT_PAGE = 1000;

/**
 * Makes `categoryId` the learned category of `vendor` for transactions of
 * `type`. The category must already be checked as the caller's own.
 */
export async function rememberVendorCategory(
  db: RememberDb,
  userId: string,
  vendor: string,
  type: 'expense' | 'income',
  categoryId: string,
): Promise<{ ok: boolean; error?: string }> {
  const name = vendor.trim();
  const key = vendorKey(name);
  if (!key || !categoryId) return { ok: false, error: 'No vendor name to remember' };
  const contactType = contactTypeForTransaction(type);

  const { data: contacts, error: readError } = await db
    .from('user_contacts')
    .select('id, name')
    .eq('user_id', userId)
    .eq('contact_type', contactType)
    .limit(CONTACT_PAGE);
  if (readError) return { ok: false, error: readError.message ?? 'Could not read saved contacts' };

  const matching = ((contacts ?? []) as { id: string; name: string }[])
    .filter((contact) => vendorKey(contact.name) === key)
    .map((contact) => contact.id);

  if (matching.length > 0) {
    const { error } = await db
      .from('user_contacts')
      .update({ default_category_id: categoryId })
      .in('id', matching)
      .eq('user_id', userId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { data: inserted } = await db
    .from('user_contacts')
    .insert({ user_id: userId, name, contact_type: contactType, default_category_id: categoryId, notes: null })
    .select('id')
    .maybeSingle();
  if (inserted) return { ok: true };

  // A contact with this exact name exists beyond the first page read above: update it.
  const { data: updated, error } = await db
    .from('user_contacts')
    .update({ default_category_id: categoryId })
    .eq('user_id', userId)
    .eq('contact_type', contactType)
    .eq('name', name)
    .select('id');
  if (error || !updated?.length) return { ok: false, error: error?.message ?? 'Could not save the vendor' };
  return { ok: true };
}
