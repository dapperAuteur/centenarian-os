'use client';

// lib/hooks/useCategoryTree.ts
// The one category tree (life areas above budget categories, migration 223) for client
// components. Every picker on a page shares one request: the answer is kept for a few seconds,
// and invalidateCategoryTree() (called after any change to the tree) makes every mounted user
// load it again.

import { useEffect, useState } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import type { BudgetCategoryRow, LifeAreaRow, LifeAreaSuggestion } from '@/lib/categories/tree';

export interface CategoryTreeData {
  lifeAreas: LifeAreaRow[];
  budgetCategories: (BudgetCategoryRow & { life_category_id: string | null })[];
  /** False until migration 223 is applied. */
  ready: boolean;
  suggestions: Record<string, LifeAreaSuggestion>;
}

/** How long one answer is shared between pickers mounting at the same time. */
const SHARE_MS = 15_000;

let cached: { at: number; promise: Promise<CategoryTreeData | null> } | null = null;
const listeners = new Set<() => void>();

async function fetchTree(): Promise<CategoryTreeData | null> {
  try {
    const res = await offlineFetch('/api/categories/tree');
    if (!res.ok) return null;
    const body = await res.json();
    return {
      lifeAreas: Array.isArray(body.life_areas) ? body.life_areas : [],
      budgetCategories: Array.isArray(body.budget_categories) ? body.budget_categories : [],
      ready: body.ready === true,
      suggestions: body.suggestions && typeof body.suggestions === 'object' ? body.suggestions : {},
    };
  } catch {
    return null;
  }
}

function sharedTree(): Promise<CategoryTreeData | null> {
  if (!cached || Date.now() - cached.at > SHARE_MS) cached = { at: Date.now(), promise: fetchTree() };
  return cached.promise;
}

/** Drops the shared answer and makes every mounted useCategoryTreeData load the tree again. */
export function invalidateCategoryTree(): void {
  cached = null;
  for (const listener of [...listeners]) listener();
}

export function useCategoryTreeData(): { data: CategoryTreeData | null; loading: boolean; refetch: () => void } {
  const [data, setData] = useState<CategoryTreeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const run = () => {
      sharedTree().then((next) => {
        if (!alive) return;
        setData(next);
        setLoading(false);
      });
    };
    run();
    listeners.add(run);
    return () => {
      alive = false;
      listeners.delete(run);
    };
  }, []);

  return { data, loading, refetch: invalidateCategoryTree };
}
