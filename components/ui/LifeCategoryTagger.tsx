'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Tags, X, Plus, ChevronDown } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

type EntityType =
  | 'task' | 'trip' | 'route' | 'transaction' | 'recipe'
  | 'fuel_log' | 'maintenance' | 'invoice' | 'workout' | 'equipment' | 'focus_session';

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
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

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
    setShowDropdown(false);

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

  if (loading) {
    return <div className="h-6 w-20 bg-gray-100 rounded animate-pulse" />;
  }

  // Compact mode: small dots + plus button
  if (compact) {
    return (
      <div className="flex items-center gap-1 relative" ref={dropdownRef}>
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => handleUntag(tag)}
            title={`${tag.name} (click to remove)`}
            className="w-4 h-4 rounded-full border border-white shadow-sm hover:scale-125 transition"
            style={{ backgroundColor: tag.color }}
          />
        ))}
        {available.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDropdown((p) => !p)}
            className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600 transition"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
        {showDropdown && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 min-w-36">
            {available.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleTag(cat.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-50 text-left transition"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full mode: labeled section with chips
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Tags className="w-3.5 h-3.5" />
          Life Categories
        </h4>
        {available.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDropdown((p) => !p)}
              className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Tag
              <ChevronDown className={`w-3 h-3 transition ${showDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 min-w-40">
                {available.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleTag(cat.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded hover:bg-gray-50 text-left transition"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
              />
              <span className="font-medium">{tag.name}</span>
              <button
                type="button"
                onClick={() => handleUntag(tag)}
                className="ml-0.5 opacity-60 hover:opacity-100 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No life categories assigned.</p>
      )}
    </div>
  );
}
