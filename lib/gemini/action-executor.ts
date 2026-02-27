// lib/gemini/action-executor.ts
// Processes parsed action blocks from AI responses and executes them.

import { SupabaseClient } from '@supabase/supabase-js';
import { GemAction, ActionType } from './gemini-parser';
import { generateSlug, makeUniqueSlug } from '@/lib/recipes/slug';

export interface ActionResult {
  type: ActionType;
  success: boolean;
  message: string;
  entityId?: string;
}

export async function executeActions(
  db: SupabaseClient,
  userId: string,
  sessionId: string | null,
  gemPersonaId: string,
  actions: GemAction[],
  fileData?: { name: string; headers?: string[]; rows?: Record<string, string>[] }[],
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    let result: ActionResult;
    try {
      result = await executeSingleAction(db, userId, action, fileData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      result = { type: action.type, success: false, message: msg };
    }

    results.push(result);

    // Audit log
    await db
      .from('gem_action_log')
      .insert({
        user_id: userId,
        session_id: sessionId,
        gem_persona_id: gemPersonaId,
        action_type: action.type,
        action_payload: action.data,
        result_status: result.success ? 'success' : 'error',
        result_data: result.success ? { entityId: result.entityId } : null,
        error_message: result.success ? null : result.message,
      })
      .then(({ error }) => {
        if (error) console.error('Failed to log gem action:', error);
      });
  }

  return results;
}

async function executeSingleAction(
  db: SupabaseClient,
  userId: string,
  action: GemAction,
  fileData?: { name: string; headers?: string[]; rows?: Record<string, string>[] }[],
): Promise<ActionResult> {
  switch (action.type) {
    case 'CREATE_RECIPE':
      return createRecipe(db, userId, action.data);
    case 'LOG_WORKOUT':
      return logWorkout(db, userId, action.data);
    case 'CREATE_TRANSACTION':
      return createTransaction(db, userId, action.data);
    case 'CREATE_TASK':
      return createTask(db, userId, action.data);
    case 'CREATE_GEM':
      return createGem(db, userId, action.data);
    case 'IMPORT_TRANSACTIONS':
      return importTransactions(db, userId, action.data, fileData);
    default:
      return { type: action.type, success: false, message: `Unknown action type: ${action.type}` };
  }
}

// ── Action handlers ────────────────────────────────────────────────

async function createRecipe(
  db: SupabaseClient,
  userId: string,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const title = data.title as string;
  if (!title) return { type: 'CREATE_RECIPE', success: false, message: 'Missing recipe title' };

  const baseSlug = generateSlug(title);
  const slug = await makeUniqueSlug(baseSlug, async (candidate) => {
    const { data: existing } = await db
      .from('recipes')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    return !!existing;
  });

  const { data: recipe, error } = await db
    .from('recipes')
    .insert({
      user_id: userId,
      title,
      slug,
      description: (data.description as string) || null,
      tags: (data.tags as string[]) || [],
      servings: (data.servings as number) || null,
      prep_time_minutes: (data.prep_time_minutes as number) || null,
      cook_time_minutes: (data.cook_time_minutes as number) || null,
      visibility: 'draft',
    })
    .select('id')
    .single();

  if (error || !recipe) {
    return { type: 'CREATE_RECIPE', success: false, message: error?.message || 'Insert failed' };
  }

  // Insert ingredients if provided
  const ingredients = data.ingredients as { name: string; quantity?: number; unit?: string }[] | undefined;
  if (ingredients?.length) {
    const rows = ingredients.map((ing, i) => ({
      recipe_id: recipe.id,
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      sort_order: i,
    }));
    await db.from('recipe_ingredients').insert(rows);
  }

  return {
    type: 'CREATE_RECIPE',
    success: true,
    message: `Recipe "${title}" created as draft`,
    entityId: recipe.id,
  };
}

async function logWorkout(
  db: SupabaseClient,
  userId: string,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const name = data.name as string;
  if (!name) return { type: 'LOG_WORKOUT', success: false, message: 'Missing workout name' };

  const { data: log, error } = await db
    .from('workout_logs')
    .insert({
      user_id: userId,
      name,
      date: (data.date as string) || new Date().toISOString().split('T')[0],
      duration_min: (data.duration_min as number) || null,
      notes: (data.notes as string) || null,
    })
    .select('id')
    .single();

  if (error || !log) {
    return { type: 'LOG_WORKOUT', success: false, message: error?.message || 'Insert failed' };
  }

  // Insert exercises if provided
  const exercises = data.exercises as {
    name: string;
    sets_completed?: number;
    reps_completed?: number;
    weight_lbs?: number;
    duration_sec?: number;
  }[] | undefined;

  if (exercises?.length) {
    const rows = exercises.map((ex, i) => ({
      log_id: log.id,
      name: ex.name,
      sets_completed: ex.sets_completed ?? null,
      reps_completed: ex.reps_completed ?? null,
      weight_lbs: ex.weight_lbs ?? null,
      duration_sec: ex.duration_sec ?? null,
      sort_order: i,
    }));
    await db.from('workout_log_exercises').insert(rows);
  }

  return {
    type: 'LOG_WORKOUT',
    success: true,
    message: `Workout "${name}" logged`,
    entityId: log.id,
  };
}

async function createTransaction(
  db: SupabaseClient,
  userId: string,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const amount = data.amount as number;
  const type = data.type as string;
  if (!amount || !type) {
    return { type: 'CREATE_TRANSACTION', success: false, message: 'Missing amount or type' };
  }

  const { data: tx, error } = await db
    .from('financial_transactions')
    .insert({
      user_id: userId,
      amount,
      type,
      transaction_date: (data.transaction_date as string) || new Date().toISOString().split('T')[0],
      vendor: (data.vendor as string) || null,
      notes: (data.notes as string) || null,
      category_id: (data.category_id as string) || null,
      tags: (data.tags as string[]) || [],
    })
    .select('id')
    .single();

  if (error || !tx) {
    return { type: 'CREATE_TRANSACTION', success: false, message: error?.message || 'Insert failed' };
  }

  return {
    type: 'CREATE_TRANSACTION',
    success: true,
    message: `${type === 'expense' ? 'Expense' : 'Income'} of $${amount.toFixed(2)} recorded`,
    entityId: tx.id,
  };
}

async function createTask(
  db: SupabaseClient,
  userId: string,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const title = data.title as string;
  const milestoneId = data.milestone_id as string;
  if (!title || !milestoneId) {
    return { type: 'CREATE_TASK', success: false, message: 'Missing title or milestone_id' };
  }

  const { data: task, error } = await db
    .from('tasks')
    .insert({
      user_id: userId,
      milestone_id: milestoneId,
      title,
      date: (data.date as string) || new Date().toISOString().split('T')[0],
      priority: (data.priority as string) || 'medium',
      activity: (data.activity as string) || null,
      status: 'active',
    })
    .select('id')
    .single();

  if (error || !task) {
    return { type: 'CREATE_TASK', success: false, message: error?.message || 'Insert failed' };
  }

  return {
    type: 'CREATE_TASK',
    success: true,
    message: `Task "${title}" created`,
    entityId: task.id,
  };
}

async function createGem(
  db: SupabaseClient,
  userId: string,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const name = data.name as string;
  const systemPrompt = data.system_prompt as string;
  if (!name || !systemPrompt) {
    return { type: 'CREATE_GEM', success: false, message: 'Missing name or system_prompt' };
  }

  const { data: gem, error } = await db
    .from('gem_personas')
    .insert({
      user_id: userId,
      name,
      description: (data.description as string) || null,
      system_prompt: systemPrompt,
      data_sources: (data.data_sources as string[]) || [],
      category: (data.category as string) || 'general',
      can_take_actions: (data.can_take_actions as boolean) || false,
    })
    .select('id')
    .single();

  if (error || !gem) {
    return { type: 'CREATE_GEM', success: false, message: error?.message || 'Insert failed' };
  }

  return {
    type: 'CREATE_GEM',
    success: true,
    message: `Gem "${name}" created`,
    entityId: gem.id,
  };
}

async function importTransactions(
  db: SupabaseClient,
  userId: string,
  data: Record<string, unknown>,
  fileData?: { name: string; headers?: string[]; rows?: Record<string, string>[] }[],
): Promise<ActionResult> {
  const sourceFile = data.source_file as string;
  const columnMapping = data.column_mapping as Record<string, string> | undefined;
  const defaults = (data.defaults as Record<string, string>) || {};

  if (!sourceFile || !columnMapping) {
    return { type: 'IMPORT_TRANSACTIONS', success: false, message: 'Missing source_file or column_mapping' };
  }

  // Find the file data by name
  const file = fileData?.find(f => f.name === sourceFile);
  if (!file?.rows?.length) {
    return { type: 'IMPORT_TRANSACTIONS', success: false, message: `No parsed data found for "${sourceFile}"` };
  }

  // Fetch existing budget categories for name matching
  const { data: categories } = await db
    .from('budget_categories')
    .select('id, name')
    .eq('user_id', userId);

  const catMap = new Map<string, string>();
  for (const c of categories || []) {
    catMap.set(c.name.toLowerCase(), c.id);
  }

  const payloads: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (let i = 0; i < file.rows.length; i++) {
    const row = file.rows[i];

    // Map columns using the AI-provided mapping
    const dateCol = columnMapping.transaction_date;
    const amountCol = columnMapping.amount;
    const typeCol = columnMapping.type;
    const vendorCol = columnMapping.vendor;
    const descCol = columnMapping.description;
    const categoryCol = columnMapping.category_name;
    const notesCol = columnMapping.notes;

    // Extract values from CSV row using mapped column names
    let dateVal = dateCol ? row[dateCol]?.trim() : undefined;
    const amountVal = amountCol ? row[amountCol]?.trim() : undefined;
    const typeVal = typeCol ? row[typeCol]?.trim() : defaults.type;
    const vendorVal = vendorCol ? row[vendorCol]?.trim() : undefined;
    const descVal = descCol ? row[descCol]?.trim() : undefined;
    const categoryVal = categoryCol ? row[categoryCol]?.trim() : undefined;
    const notesVal = notesCol ? row[notesCol]?.trim() : undefined;

    // Validate and normalize date
    if (!dateVal) {
      errors.push(`Row ${i + 1}: missing date`);
      continue;
    }
    // Handle MM/DD/YYYY format
    const mdyMatch = dateVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) {
      dateVal = `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      errors.push(`Row ${i + 1}: invalid date "${dateVal}"`);
      continue;
    }

    // Validate amount
    const rawAmount = amountVal ? parseFloat(amountVal.replace(/[,$]/g, '')) : NaN;
    if (isNaN(rawAmount) || rawAmount === 0) {
      errors.push(`Row ${i + 1}: invalid amount "${amountVal}"`);
      continue;
    }

    // Determine type from amount sign or mapping or default
    let txType: string;
    if (typeVal) {
      txType = typeVal.toLowerCase().includes('income') ? 'income' : 'expense';
    } else {
      txType = rawAmount < 0 ? 'expense' : 'income';
    }

    // Resolve category by name
    const categoryId = categoryVal ? catMap.get(categoryVal.toLowerCase()) || null : null;

    payloads.push({
      user_id: userId,
      transaction_date: dateVal,
      amount: Math.abs(rawAmount),
      type: txType,
      description: descVal || null,
      vendor: vendorVal || null,
      category_id: categoryId,
      notes: notesVal || null,
      source: 'csv_import',
    });
  }

  if (payloads.length === 0) {
    return {
      type: 'IMPORT_TRANSACTIONS',
      success: false,
      message: `No valid rows to import. ${errors.length} errors: ${errors.slice(0, 3).join('; ')}`,
    };
  }

  // Bulk insert (Supabase supports up to ~1000 rows per insert)
  const BATCH_SIZE = 500;
  let totalInserted = 0;

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    const { data: inserted, error } = await db
      .from('financial_transactions')
      .insert(batch)
      .select('id');

    if (error) {
      return {
        type: 'IMPORT_TRANSACTIONS',
        success: false,
        message: `Import failed at batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}. ${totalInserted} rows imported before failure.`,
      };
    }
    totalInserted += inserted?.length || 0;
  }

  const skipped = file.rows.length - payloads.length;
  return {
    type: 'IMPORT_TRANSACTIONS',
    success: true,
    message: `Imported ${totalInserted} transactions from "${sourceFile}"${skipped > 0 ? ` (${skipped} rows skipped)` : ''}`,
  };
}
