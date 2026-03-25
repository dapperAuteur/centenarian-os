'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Tags, Plus, Trash2, Pencil, ChevronDown, ChevronRight, Settings,
  Check, X, Loader2,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';

interface LifeCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

interface CategoryAnalytics {
  id: string;
  name: string;
  icon: string;
  color: string;
  entity_count: number;
  spending: number;
  entity_breakdown: Record<string, number>;
}

interface UncategorizedItem {
  id: string;
  display_name: string;
  date: string;
  entity_type: string;
}

interface ModuleGroup {
  label: string;
  count: number;
  items: UncategorizedItem[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<LifeCategory[]>([]);
  const [analytics, setAnalytics] = useState<CategoryAnalytics[]>([]);
  const [uncategorized, setUncategorized] = useState<Record<string, ModuleGroup>>({});
  const [totalUncategorized, setTotalUncategorized] = useState(0);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  // Manage panel
  const [showManage, setShowManage] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6b7280');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [saving, setSaving] = useState(false);

  // Expanded modules in uncategorized section
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Batch tagging
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [batchCategoryId, setBatchCategoryId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, analyticsRes, uncatRes] = await Promise.all([
        offlineFetch('/api/life-categories'),
        offlineFetch(`/api/life-categories/analytics?period=${period}`),
        offlineFetch(`/api/life-categories/uncategorized?period=${period}`),
      ]);

      if (catRes.ok) {
        const d = await catRes.json();
        setCategories(d.categories || []);
      }
      if (analyticsRes.ok) {
        const d = await analyticsRes.json();
        setAnalytics(d.analytics || []);
      }
      if (uncatRes.ok) {
        const d = await uncatRes.json();
        setUncategorized(d.uncategorized || {});
        setTotalUncategorized(d.total_uncategorized || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  function toggleModule(mod: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  }

  function toggleSelectItem(key: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleBatchTag() {
    if (!batchCategoryId || selectedItems.size === 0) return;
    setSaving(true);
    const promises = Array.from(selectedItems).map((key) => {
      const [entityType, entityId] = key.split(':');
      return offlineFetch('/api/life-categories/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, life_category_id: batchCategoryId }),
      });
    });
    await Promise.all(promises);
    setSelectedItems(new Set());
    setBatchCategoryId('');
    setSaving(false);
    load();
  }

  // Remove item from uncategorized list after tagging
  function handleItemTagged(entityType: string, entityId: string) {
    setUncategorized((prev) => {
      const next = { ...prev };
      if (next[entityType]) {
        next[entityType] = {
          ...next[entityType],
          items: next[entityType].items.filter((i) => i.id !== entityId),
          count: next[entityType].count - 1,
        };
        if (next[entityType].count <= 0) delete next[entityType];
      }
      return next;
    });
    setTotalUncategorized((p) => Math.max(0, p - 1));
  }

  // Manage: create category
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const res = await offlineFetch('/api/life-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
    });
    if (res.ok) {
      setNewCatName('');
      setNewCatColor('#6b7280');
      load();
    }
  }

  async function handleUpdateCategory(id: string) {
    const res = await offlineFetch(`/api/life-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    });
    if (res.ok) {
      setEditingId(null);
      load();
    }
  }

  async function handleDeleteCategory(id: string) {
    const res = await offlineFetch(`/api/life-categories/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  const pieData = analytics.filter((a) => a.spending > 0);
  const barData = analytics.filter((a) => a.entity_count > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-10 w-10 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tags className="w-6 h-6" />
            Life Categories
          </h1>
          <p className="text-sm text-gray-500 mt-1">Tag activities across all modules to track how you spend time and money</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  period === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowManage((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-fuchsia-600 hover:text-fuchsia-700 border border-fuchsia-200 rounded-lg hover:bg-fuchsia-50 transition"
          >
            <Settings className="w-3.5 h-3.5" />
            Manage
          </button>
        </div>
      </div>

      {/* Manage Panel */}
      {showManage && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Manage Categories</h2>
          <form onSubmit={handleCreateCategory} className="flex items-center gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New category name"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
            />
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="w-9 h-9 border rounded-lg cursor-pointer shrink-0"
            />
            <button
              type="submit"
              disabled={!newCatName.trim()}
              className="px-4 py-2 bg-fuchsia-600 text-white text-sm font-medium rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
          <div className="space-y-1.5">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
                {editingId === cat.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-7 h-7 border rounded cursor-pointer"
                    />
                    <button onClick={() => handleUpdateCategory(cat.id)} className="text-green-600 hover:text-green-700">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm text-gray-700">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color); }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {analytics.map((cat) => (
          <div
            key={cat.id}
            className="bg-white border border-gray-200 rounded-xl p-4"
            style={{ borderLeftColor: cat.color, borderLeftWidth: 3 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="text-sm font-medium text-gray-700">{cat.name}</span>
            </div>
            <div className="text-xl font-bold text-gray-900">{cat.entity_count}</div>
            <div className="text-xs text-gray-500">
              {cat.entity_count === 1 ? 'item' : 'items'}
              {cat.spending > 0 && (
                <span className="ml-1 text-gray-400">
                  &middot; ${cat.spending.toFixed(0)} spent
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Spending Pie */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h2>
          {pieData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData as unknown as Record<string, unknown>[]}
                    dataKey="spending"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ name, percent }: any) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => `$${Number(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">Tag some transactions to see spending breakdown</p>
          )}
        </div>

        {/* Activity Bar Chart */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity by Category</h2>
          {barData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 60, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    width={55}
                  />
                  <Tooltip />
                  <Bar dataKey="entity_count" name="Items" radius={[0, 4, 4, 0]}>
                    {barData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">Tag items to see activity breakdown</p>
          )}
        </div>
      </div>

      {/* Uncategorized Items */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Uncategorized Items
            {totalUncategorized > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                {totalUncategorized}
              </span>
            )}
          </h2>
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{selectedItems.size} selected</span>
              <select
                value={batchCategoryId}
                onChange={(e) => setBatchCategoryId(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900"
              >
                <option value="">Tag as...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={handleBatchTag}
                disabled={!batchCategoryId || saving}
                className="px-3 py-1.5 bg-fuchsia-600 text-white text-xs font-medium rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 transition flex items-center gap-1"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Tag
              </button>
            </div>
          )}
        </div>

        {totalUncategorized === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">All items are categorized!</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(uncategorized).map(([entityType, group]) => (
              <div key={entityType} className="border border-gray-100 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleModule(entityType)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-2">
                    {expandedModules.has(entityType) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-700">{group.label}</span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                      {group.count}
                    </span>
                  </div>
                </button>

                {expandedModules.has(entityType) && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {group.items.map((item) => {
                      const itemKey = `${entityType}:${item.id}`;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedItems.has(itemKey)}
                            onChange={() => toggleSelectItem(itemKey)}
                            className="shrink-0 rounded border-gray-300"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-700 truncate">{item.display_name}</div>
                            <div className="text-xs text-gray-400">{item.date}</div>
                          </div>
                          <LifeCategoryTagger
                            entityType={entityType as Parameters<typeof LifeCategoryTagger>[0]['entityType']}
                            entityId={item.id}
                            compact
                            categories={categories}
                            onTagChange={() => handleItemTagged(entityType, item.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
