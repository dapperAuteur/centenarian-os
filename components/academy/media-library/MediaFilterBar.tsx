'use client';

// components/academy/media-library/MediaFilterBar.tsx
// Search input + tag chip filter shared between the full library page
// and the MediaPickerModal. Controlled: parent owns the query and
// selectedTags state so either surface can persist filters independently.

import { Search, X } from 'lucide-react';

interface MediaFilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  resultCount: number;
  totalCount: number;
}

export default function MediaFilterBar({
  query,
  onQueryChange,
  availableTags,
  selectedTags,
  onToggleTag,
  resultCount,
  totalCount,
}: MediaFilterBarProps) {
  const isFiltering = query.trim().length > 0 || selectedTags.length > 0;

  return (
    <div className="space-y-3 dark-input">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name, description, or tag…"
          aria-label="Search media library"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500 min-h-11"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center text-gray-400 hover:text-white transition"
            aria-label="Clear search"
            title="Clear"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
          {availableTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                aria-pressed={isSelected}
                className={`min-h-11 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                  isSelected
                    ? 'bg-fuchsia-600 border-fuchsia-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      {isFiltering && (
        <p className="text-xs text-gray-500" aria-live="polite">
          Showing {resultCount} of {totalCount} {totalCount === 1 ? 'asset' : 'assets'}.
          {(resultCount !== totalCount) && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => { onQueryChange(''); selectedTags.forEach(onToggleTag); }}
                className="text-fuchsia-400 hover:text-fuchsia-300 underline"
              >
                Clear filters
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
