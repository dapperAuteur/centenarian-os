'use client';

// components/media/MediaAutocomplete.tsx
// Datalist autocomplete for saved media creators and platforms.
// - Fetches suggestions sorted by use_count (most-used first)
// - On blur with a new value, offers inline "Save?" prompt
// - On selecting a known value, increments use_count server-side
// - Works offline via offlineFetch

import { useEffect, useRef, useState, useCallback } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface SavedItem {
  id: string;
  name: string;
  use_count: number;
}

interface MediaAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  endpoint: '/api/media/creators' | '/api/media/platforms';
  label: string;
  id: string;
  placeholder?: string;
  className?: string;
}

export default function MediaAutocomplete({
  value,
  onChange,
  endpoint,
  label,
  id,
  placeholder,
  className,
}: MediaAutocompleteProps) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [showSave, setShowSave] = useState(false);
  const listId = useRef(`media-ac-${id}-${Math.random().toString(36).slice(2, 7)}`);

  const loadItems = useCallback(() => {
    offlineFetch(endpoint)
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [endpoint]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSave(false);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (!val) { setShowSave(false); return; }

    const match = items.find((i) => i.name.toLowerCase() === val.toLowerCase());
    if (match) {
      // Known item — increment use_count
      offlineFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: match.name }),
      }).catch(() => {});
      onChange(match.name);
      setShowSave(false);
    } else {
      setShowSave(true);
    }
  };

  const handleSave = async () => {
    if (!value.trim()) return;
    const res = await offlineFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: value.trim() }),
    });
    if (res.ok) {
      const saved = await res.json();
      setItems((prev) => [saved, ...prev.filter((i) => i.id !== saved.id)]);
    }
    setShowSave(false);
  };

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        id={id}
        type="text"
        list={listId.current}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className || 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm'}
        autoComplete="off"
        aria-autocomplete="list"
        aria-label={label}
      />
      <datalist id={listId.current}>
        {items.map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>
      {showSave && value.trim() && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs text-gray-400">Save &ldquo;{value.trim()}&rdquo;?</span>
          <button
            type="button"
            onClick={handleSave}
            className="text-xs text-fuchsia-600 hover:underline font-medium min-h-6"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setShowSave(false)}
            className="text-xs text-gray-400 hover:text-gray-600 min-h-6"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
