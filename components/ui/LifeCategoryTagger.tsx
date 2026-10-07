'use client';

// components/ui/LifeCategoryTagger.tsx
// The life areas (life categories, the top level of the one category tree) an item is tagged
// with, and a picker to add more. For a transaction, the life area that comes from its budget
// category is shown as "from <category>" and can't be removed here: change the category to
// change it (plans/63 E, migration 223). Tags a person added can always be removed.

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Tags, X, Plus } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import CategoryTreePicker from '@/components/categories/CategoryTreePicker';
import { buildCategoryTree } from '@/lib/categories/tree';

type EntityType =
  | 'task' | 'trip' | 'route' | 'transaction' | 'recipe'
  | 'fuel_log' | 'maintenance' | 'invoice' | 'workout' | 'equipment' | 'focus_session' | 'exercise' | 'daily_log'
  | 'media_item' | 'podcast_episode' | 'blog_post';

interface LifeCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface EntityTag {
  id: string;
  life_category_id: string;
  name: string;
  icon: string;
  color: string;
  /** Added by the app from the transaction's budget category (follows the category). */
  auto?: boolean;
  /** Counted from the budget category, no tag row yet. */
  derived?: boolean;
  /** The budget category the life area comes from. */
  from_category?: string;
}

interface LifeCategoryTaggerProps {
  entityType: EntityType;
  entityId: string;
  compact?: boolean;
  categories?: LifeCategory[];
  onTagChange?: () => void;
}

export default function LifeCategoryTagger({
  entityType,
  entityId,
  compact = false,
  categories: externalCategories,
  onTagChange,
}: LifeCategoryTaggerProps) {
  const [allCategories, setAllCategories] = useState<LifeCategory[]>(externalCategories || []);
  const [tags, setTags] = useState<EntityTag[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTags = useCallback(async () => {
    if (!entityId) return;
    try {
      const res = await offlineFetch(
        `/api/life-categories/entity?entity_type=${entityType}&entity_id=${entityId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  const loadCategories = useCallback(async () => {
    if (externalCategories) return;
    const res = await offlineFetch('/api/life-categories');
    if (res.ok) {
      const data = await res.json();
      setAllCategories(data.categories || []);
    }
  }, [externalCategories]);

  useEffect(() => {
    loadTags();
    loadCategories();
  }, [loadTags, loadCategories]);

  useEffect(() => {
    if (externalCategories) setAllCategories(externalCategories);
  }, [externalCategories]);

  async function handleTag(categoryId: string) {
    const cat = allCategories.find((c) => c.id === categoryId);
    if (!cat) return;

    // Optimistic
    const optimisticTag: EntityTag = {
      id: `temp-${Date.now()}`,
      life_category_id: categoryId,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
    };
    setTags((prev) => [...prev, optimisticTag]);

    const res = await offlineFetch('/api/life-categories/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, life_category_id: categoryId }),
    });

    if (res.ok) {
      loadTags();
      onTagChange?.();
    } else {
      // Rollback
      setTags((prev) => prev.filter((t) => t.id !== optimisticTag.id));
    }
  }

  async function handleUntag(tag: EntityTag) {
    // Optimistic
    setTags((prev) => prev.filter((t) => t.id !== tag.id));

    const res = await offlineFetch('/api/life-categories/untag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: entityType,
        entity_id: entityId,
        life_category_id: tag.life_category_id,
      }),
    });

    if (!res.ok) {
      // Rollback
      setTags((prev) => [...prev, tag]);
    } else {
      onTagChange?.();
    }
  }

  const taggedIds = new Set(tags.map((t) => t.life_category_id));
  const available = allCategories.filter((c) => !taggedIds.has(c.id));
  // The same tree picker as everywhere else, showing only life areas.
  const tree = useMemo(() => buildCategoryTree(allCategories, []), [allCategories]);
  const exclude = useMemo(() => new Set(tags.map((t) => `life:${t.life_category_id}`)), [tags]);

  const picker = (compactTrigger: boolean) => (
    <CategoryTreePicker
      tree={tree}
      value={null}
      onChange={(selection) => {
        if (selection?.kind === 'life') handleTag(selection.id);
      }}
      mode="life"
      allowNone={false}
      exclude={exclude}
      label="Add a life area"
      hideLabel
      variant="button"
      align={compactTrigger ? 'left' : 'right'}
      buttonLabel={
        compactTrigger ? (
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <>
            <Plus className="w-3 h-3" aria-hidden="true" /> Tag
          </>
        )
      }
    />
  );

  const autoNote = (tag: EntityTag) =>
    tag.from_category ? `from ${tag.from_category}` : 'from its category';

  if (loading) {
    return <div className="h-6 w-20 bg-gray-100 rounded animate-pulse" role="status" aria-label="Loading..." />;
  }

  // Compact mode: small dots + plus button
  if (compact) {
    return (
      <div className="flex items-center gap-1 relative">
        {tags.map((tag) =>
          tag.auto ? (
            <span
              key={tag.id}
              title={`${tag.name} (${autoNote(tag)})`}
              className="w-4 h-4 rounded-full border border-white shadow-sm ring-1 ring-gray-300"
              style={{ backgroundColor: tag.color }}
            >
              <span className="sr-only">{`${tag.name}, ${autoNote(tag)}`}</span>
            </span>
          ) : (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleUntag(tag)}
              title={`${tag.name} (click to remove)`}
              aria-label={`Remove life area ${tag.name}`}
              className="w-4 h-4 rounded-full border border-white shadow-sm hover:scale-125 transition"
              style={{ backgroundColor: tag.color }}
            />
          ),
        )}
        {available.length > 0 && picker(true)}
      </div>
    );
  }

  // Full mode: labeled section with chips
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Tags className="w-3.5 h-3.5" aria-hidden="true" />
          Life areas
        </h4>
        {available.length > 0 && picker(false)}
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs"
              style={{
                backgroundColor: `${tag.color}10`,
                borderColor: `${tag.color}30`,
                color: tag.color,
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
                aria-hidden="true"
              />
              <span className="font-medium">{tag.name}</span>
              {tag.auto ? (
                <span className="text-gray-600" title="Change the transaction's category to change this life area">
                  · {autoNote(tag)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUntag(tag)}
                  aria-label={`Remove life area ${tag.name}`}
                  className="ml-0.5 min-h-11 min-w-11 -my-3 -mr-2 flex items-center justify-center opacity-60 hover:opacity-100 transition"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">No life areas yet.</p>
      )}
    </div>
  );
}
