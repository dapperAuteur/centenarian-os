// lib/finance/linked-transaction.ts
// Server-side helper to create, update, and delete financial_transactions that are
// auto-generated from travel module records (fuel_logs, vehicle_maintenance, trips).
// Uses the service role client to bypass RLS — only call from API routes.

import type { SupabaseClient } from '@supabase/supabase-js';

type SourceModule = 'fuel_log' | 'vehicle_maintenance' | 'trip';

interface CreateParams {
  userId: string;
  amount: number;
  vendor?: string | null;
  date: string;          // YYYY-MM-DD
  source_module: SourceModule;
  source_module_id: string;
  description?: string;
  category_id?: string | null;
}

interface UpdateParams {
  amount?: number;
  vendor?: string | null;
  date?: string;
  description?: string;
}

/**
 * Creates a new expense financial_transaction linked to a travel module record.
 * Returns the created transaction's UUID.
 */
export async function createLinkedTransaction(
  db: SupabaseClient,
  params: CreateParams,
): Promise<string> {
  const { userId, amount, vendor, date, source_module, source_module_id, description, category_id } = params;

  const { data, error } = await db
    .from('financial_transactions')
    .insert({
      user_id: userId,
      amount: Math.abs(amount),
      type: 'expense',
      vendor: vendor ?? null,
      description: description ?? null,
      transaction_date: date,
      source: source_module,
      source_module,
      source_module_id,
      category_id: category_id ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`createLinkedTransaction failed: ${error.message}`);
  return data.id;
}

/**
 * Updates the amount, vendor, date, and/or description of an existing linked transaction.
 */
export async function updateLinkedTransaction(
  db: SupabaseClient,
  transactionId: string,
  params: UpdateParams,
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.amount !== undefined) updates.amount = Math.abs(params.amount);
  if (params.vendor !== undefined) updates.vendor = params.vendor;
  if (params.date !== undefined) updates.transaction_date = params.date;
  if (params.description !== undefined) updates.description = params.description;

  const { error } = await db
    .from('financial_transactions')
    .update(updates)
    .eq('id', transactionId);

  if (error) throw new Error(`updateLinkedTransaction failed: ${error.message}`);
}

/**
 * Hard-deletes a linked financial_transaction.
 */
export async function deleteLinkedTransaction(
  db: SupabaseClient,
  transactionId: string,
): Promise<void> {
  const { error } = await db
    .from('financial_transactions')
    .delete()
    .eq('id', transactionId);

  if (error) throw new Error(`deleteLinkedTransaction failed: ${error.message}`);
}
