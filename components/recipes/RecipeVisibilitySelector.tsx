'use client';

import type { RecipeVisibility } from '@/lib/types';

interface RecipeVisibilitySelectorProps {
  value: RecipeVisibility;
  onChange: (v: RecipeVisibility) => void;
  scheduledAt: string | null;
  onScheduledAtChange: (iso: string | null) => void;
}

const VISIBILITY_OPTIONS: { value: RecipeVisibility; label: string; description: string }[] = [
  { value: 'draft', label: 'Draft', description: 'Only visible to you, not listed anywhere' },
  { value: 'private', label: 'Private', description: 'Only visible when you are logged in' },
  { value: 'public', label: 'Public', description: 'Visible to anyone, listed in the recipe directory' },
  { value: 'authenticated_only', label: 'Members Only', description: 'Only visible to logged-in users' },
  { value: 'scheduled', label: 'Scheduled', description: 'Publish automatically at a set date and time' },
];

export default function RecipeVisibilitySelector({
  value,
  onChange,
  scheduledAt,
  onScheduledAtChange,
}: RecipeVisibilitySelectorProps) {
  const selected = VISIBILITY_OPTIONS.find((o) => o.value === value);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Visibility</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RecipeVisibility)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        {VISIBILITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {selected && (
        <p className="text-xs text-gray-500">{selected.description}</p>
      )}
      {value === 'scheduled' && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Publish date &amp; time</label>
          <input
            type="datetime-local"
            value={scheduledAt ? scheduledAt.slice(0, 16) : ''}
            onChange={(e) =>
              onScheduledAtChange(e.target.value ? new Date(e.target.value).toISOString() : null)
            }
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      )}
    </div>
  );
}
