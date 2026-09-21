// lib/finance/learned-categories.ts
// Server-side loading of learned vendor categories. A vendor's learned category
// is the default_category_id on its saved contact (user_contacts). The user
// sets it by answering "Always" to the prompt shown after categorizing a
// transaction, or by editing the contact.
//
// Applied whenever a transaction arrives with no category: manual POST
// /api/finance/transactions (which the receipt scan also uses), Teller sync
// and connect, and CSV import.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildLearnedCategoryIndex,
  lookupLearnedCategory,
  type LearnedCategoryContact,
  type LearnedCategoryIndex,
} from './transaction-matching';

/**
 * Loads the user's vendor and customer contacts that have a default category
 * and indexes them by vendor key. A failed read returns an empty index: a
 * missing learned category must never block a save.
 */
export async function loadLearnedCategoryIndex(
  db: SupabaseClient,
  userId: string,
): Promise<LearnedCategoryIndex> {
  const { data, error } = await db
    .from('user_contacts')
    .select('name, contact_type, default_category_id, use_count')
    .eq('user_id', userId)
    .in('contact_type', ['vendor', 'customer'])
    .not('default_category_id', 'is', null)
    .limit(1000);
  if (error || !data) return buildLearnedCategoryIndex([]);
  return buildLearnedCategoryIndex(data as LearnedCategoryContact[]);
}

/** Looks up one vendor's learned category. Returns null when there is none. */
export async function findLearnedCategory(
  db: SupabaseClient,
  userId: string,
  vendor: string | null | undefined,
  type: string | null | undefined,
): Promise<string | null> {
  if (!vendor?.trim()) return null;
  const index = await loadLearnedCategoryIndex(db, userId);
  return lookupLearnedCategory(index, vendor, type);
}
