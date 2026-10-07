'use client';

// components/finance/CategorySelect.tsx
// The budget-category field used across Finance (add transaction, importer review, recurring
// payments, invoices, cash, fuel, maintenance...). Since migration 223 it shows the one
// category tree: life areas as headings, budget categories under them, searchable, with
// "Add “…”" to create a category under a life area. The props are unchanged, so every caller
// got the tree without changes. The life area of a pick follows from the tree (plans/63 E).

import { useCallback, useMemo } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import CategoryTreePicker from '@/components/categories/CategoryTreePicker';
import { buildCategoryTree, type TreeSelection } from '@/lib/categories/tree';
import { invalidateCategoryTree, useCategoryTreeData } from '@/lib/hooks/useCategoryTree';

export interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  monthly_budget: number | null;
  /** The life area it sits under (migration 223). Absent before it. */
  life_category_id?: string | null;
}

interface CategorySelectProps<T extends { id: string; name: string }> {
  value: string;
  onChange: (categoryId: string) => void;
  categories: T[];
  onCategoryCreated: (cat: BudgetCategory) => void;
  label?: string;
  className?: string;
  /** The field's id. Pass one when several of these share a page: the default is built from the label. */
  id?: string;
  /** Kept for callers; every control is 44px tall now (CLAUDE.md touch targets). */
  size?: 'default' | 'touch';
  /** Keep the label for screen readers only (table cells, toolbars). */
  hideLabel?: boolean;
  /** Text on the closed control when nothing is picked (default "No category"). */
  placeholder?: string;
  disabled?: boolean;
}

export default function CategorySelect<T extends { id: string; name: string }>({
  value,
  onChange,
  categories,
  onCategoryCreated,
  label = 'Category',
  className = '',
  id,
  hideLabel = false,
  placeholder,
  disabled = false,
}: CategorySelectProps<T>) {
  const { data } = useCategoryTreeData();

  // The page's own list decides which categories exist (it knows about ones created a moment
  // ago); the tree endpoint decides where each one sits, falling back to the row's own field.
  const tree = useMemo(() => {
    const parentById = new Map((data?.budgetCategories ?? []).map((c) => [c.id, c.life_category_id]));
    return buildCategoryTree(
      data?.lifeAreas ?? [],
      categories as unknown as (T & { color?: string | null; life_category_id?: string | null })[],
      (category) => (parentById.has(category.id) ? parentById.get(category.id) : category.life_category_id),
    );
  }, [data, categories]);

  const selection: TreeSelection | null = value ? { kind: 'budget', id: value } : null;

  const handleCreate = useCallback(
    async (name: string, lifeAreaId: string | null): Promise<TreeSelection | null> => {
      const area = lifeAreaId ? data?.lifeAreas.find((a) => a.id === lifeAreaId) : null;
      const res = await offlineFetch('/api/finance/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: area?.color || '#6366f1', life_category_id: lifeAreaId }),
      });
      if (!res.ok) return null;
      const body = await res.json().catch(() => null);
      const category = body?.category as BudgetCategory | undefined;
      if (!category?.id) return null;
      onCategoryCreated(category);
      invalidateCategoryTree();
      return { kind: 'budget', id: category.id };
    },
    [data, onCategoryCreated],
  );

  return (
    <CategoryTreePicker
      className={className}
      tree={tree}
      value={selection}
      onChange={(next) => onChange(next?.kind === 'budget' ? next.id : '')}
      mode="budget"
      label={label}
      hideLabel={hideLabel}
      id={id ?? `catsel-${label.toLowerCase().replace(/\s+/g, '-')}`}
      placeholder={placeholder}
      disabled={disabled}
      onCreate={handleCreate}
    />
  );
}
