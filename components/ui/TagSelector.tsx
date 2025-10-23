/* eslint-disable @typescript-eslint/no-unused-vars */
// components/ui/TagSelector.tsx
'use client';

import { useState } from 'react';
import { PREDEFINED_TAGS, getTagColorClasses } from '@/lib/utils/tagUtils';
import { X, Plus } from 'lucide-react';

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

/**
 * Multi-select tag picker with predefined tags
 * Shows selected tags as chips, allows adding/removing
 */
export default function TagSelector({
  selectedTags,
  onChange,
  maxTags = 5,
}: TagSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleToggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      // Remove tag
      onChange(selectedTags.filter(t => t !== tagId));
    } else {
      // Add tag (if not at max)
      if (selectedTags.length < maxTags) {
        onChange([...selectedTags, tagId]);
      }
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTags.filter(t => t !== tagId));
  };

  const availableTags = PREDEFINED_TAGS.filter(
    tag => !selectedTags.includes(tag.id)
  );

  return (
    <div className="space-y-2">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map(tagId => {
            const tag = PREDEFINED_TAGS.find(t => t.id === tagId);
            if (!tag) return null;

            const colors = getTagColorClasses(tag.color);

            return (
              <div
                key={tag.id}
                className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text} ${colors.border} border`}
              >
                {tag.icon && <span>{tag.icon}</span>}
                <span>{tag.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag.id)}
                  className="ml-1 hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Tag Button */}
      {selectedTags.length < maxTags && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Tag</span>
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />

              {/* Menu */}
              <div className="absolute z-20 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                {availableTags.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No more tags available
                  </div>
                ) : (
                  <div className="p-2">
                    {availableTags.map(tag => {
                      const colors = getTagColorClasses(tag.color);

                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            handleToggleTag(tag.id);
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition"
                        >
                          <div className="flex items-start space-x-3">
                            <span className="text-2xl">{tag.icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-900">
                                  {tag.label}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                                >
                                  {tag.id}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {tag.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {selectedTags.length >= maxTags && (
        <p className="text-xs text-gray-500">
          Maximum {maxTags} tags selected
        </p>
      )}
    </div>
  );
}