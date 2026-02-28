'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Plus, TrendingDown, DollarSign, Layers, Upload, Download } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import EquipmentCard, { type EquipmentItem } from '@/components/equipment/EquipmentCard';
import CategoryFilter from '@/components/equipment/CategoryFilter';

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface Summary {
  totalItems: number;
  totalPurchaseValue: number;
  totalCurrentValue: number;
  depreciation: number;
  roi: number;
  totalAttributedRevenue: number;
  categories: { name: string; count: number; purchase: number; current: number }[];
}

export default function EquipmentHubPage() {
  const router = useRouter();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eqRes, catRes, sumRes] = await Promise.all([
        offlineFetch('/api/equipment'),
        offlineFetch('/api/equipment/categories'),
        offlineFetch('/api/equipment/summary'),
      ]);
      const [eqData, catData, sumData] = await Promise.all([
        eqRes.json(), catRes.json(), sumRes.json(),
      ]);
      setItems(eqData.equipment || []);
      setCategories(catData.categories || []);
      setSummary(sumData);
    } catch { /* offline fallback handled by offlineFetch */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = selectedCat
    ? items.filter((i) => i.category_id === selectedCat)
    : items;

  const cards = [
    { label: 'Total Items', value: summary?.totalItems ?? 0, icon: Package, fmt: (v: number) => String(v) },
    { label: 'Total Value', value: summary?.totalCurrentValue ?? 0, icon: DollarSign, fmt: (v: number) => `$${v.toLocaleString()}` },
    { label: 'Depreciation', value: summary?.depreciation ?? 0, icon: TrendingDown, fmt: (v: number) => `$${v.toLocaleString()}` },
    { label: 'Categories', value: summary?.categories?.length ?? 0, icon: Layers, fmt: (v: number) => String(v) },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipment</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your tools, gear, and merchandise</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/dashboard/equipment/manage')}
            className="px-4 py-2 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
          <Link
            href="/dashboard/data/import/equipment"
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded-xl text-sm font-medium hover:bg-fuchsia-100 transition"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <a
            href="/api/equipment/export"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
          >
            <Download className="w-4 h-4" />
            Export
          </a>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500">{c.label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{c.fmt(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Category filter */}
      {categories.length > 0 && (
        <CategoryFilter
          categories={categories}
          selected={selectedCat}
          onSelect={setSelectedCat}
        />
      )}

      {/* Equipment grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <EquipmentCard
              key={item.id}
              item={item}
              onClick={() => router.push(`/dashboard/equipment/${item.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {selectedCat ? 'No equipment in this category.' : 'No equipment tracked yet.'}
          </p>
          <button
            onClick={() => router.push('/dashboard/equipment/manage')}
            className="mt-3 text-sm text-fuchsia-600 hover:text-fuchsia-700 font-medium"
          >
            Add your first item
          </button>
        </div>
      )}
    </div>
  );
}
