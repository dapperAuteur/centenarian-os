'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

export interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  monthly_budget: number | null;
}

interface CategorySelectProps<T extends { id: string; name: string }> {
  value: string;
  onChange: (categoryId: string) => void;
  categories: T[];
  onCategoryCreated: (cat: BudgetCategory) => void;
  label?: string;
  className?: string;
}

export default function CategorySelect<T extends { id: string; name: string }>({
  value,
  onChange,
  categories,
  onCategoryCreated,
  label = 'Category',
  className = '',
}: CategorySelectProps<T>) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await offlineFetch('/api/finance/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (res.ok) {
        const { category } = await res.json();
        onCategoryCreated(category);
        onChange(category.id);
        setShowForm(false);
        setName('');
        setColor('#6366f1');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
        >
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowForm((p) => !p)}
          className="shrink-0 p-2 rounded-lg border text-gray-500 hover:bg-gray-50 transition"
          title="Add category"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleCreate} className="mt-2 p-3 border rounded-lg bg-gray-50 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
              placeholder="Category name"
              autoFocus
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 border rounded-lg cursor-pointer shrink-0"
            />
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="shrink-0 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition"
            >
              {saving ? '...' : 'Add'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
