'use client';

import { useState, useEffect, useRef } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { X, Search } from 'lucide-react';
import MediaUploader from '@/components/ui/MediaUploader';

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface TransactionResult {
  id: string;
  vendor: string | null;
  amount: number;
  transaction_date: string;
  type: string;
}

interface CatalogItem {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  description: string | null;
}

export interface EquipmentFormData {
  name: string;
  category_id: string | null;
  brand: string;
  model: string;
  serial_number: string;
  purchase_date: string;
  purchase_price: string;
  current_value: string;
  warranty_expires: string;
  condition: string;
  image_url: string;
  image_public_id: string;
  notes: string;
  transaction_id: string | null;
  catalog_id: string | null;
  ownership_type: string;
}

const EMPTY_FORM: EquipmentFormData = {
  name: '',
  category_id: null,
  brand: '',
  model: '',
  serial_number: '',
  purchase_date: '',
  purchase_price: '',
  current_value: '',
  warranty_expires: '',
  condition: '',
  image_url: '',
  image_public_id: '',
  notes: '',
  transaction_id: null,
  catalog_id: null,
  ownership_type: 'own',
};

const CONDITIONS = ['new', 'excellent', 'good', 'fair', 'poor'];

interface EquipmentFormProps {
  categories: Category[];
  initial?: Partial<EquipmentFormData>;
  onSubmit: (data: EquipmentFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export default function EquipmentForm({
  categories,
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: EquipmentFormProps) {
  const [form, setForm] = useState<EquipmentFormData>({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);

  // Transaction search
  const [txSearch, setTxSearch] = useState('');
  const [txResults, setTxResults] = useState<TransactionResult[]>([]);
  const [txSearching, setTxSearching] = useState(false);
  const [linkedTxLabel, setLinkedTxLabel] = useState<string | null>(null);

  // Catalog search
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogResults, setCatalogResults] = useState<CatalogItem[]>([]);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [linkedCatalogLabel, setLinkedCatalogLabel] = useState<string | null>(null);
  const catalogDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If editing and has a transaction_id, resolve its label
  useEffect(() => {
    if (initial?.transaction_id) {
      offlineFetch(`/api/finance/transactions?limit=1`)
        .then((r) => r.json())
        .then((d) => {
          const txs = d.transactions || [];
          const tx = txs.find((t: TransactionResult) => t.id === initial.transaction_id);
          if (tx) {
            setLinkedTxLabel(`${tx.vendor || 'Transaction'} $${Number(tx.amount).toFixed(2)} (${tx.transaction_date})`);
          }
        })
        .catch(() => {});
    }
  }, [initial?.transaction_id]);

  // If editing with a catalog_id, resolve its label
  useEffect(() => {
    if (initial?.catalog_id) {
      offlineFetch(`/api/equipment/catalog`)
        .then((r) => r.json())
        .then((d) => {
          const item = (d.catalog || []).find((c: CatalogItem) => c.id === initial.catalog_id);
          if (item) {
            setLinkedCatalogLabel(`${item.brand ? item.brand + ' ' : ''}${item.name}`);
          }
        })
        .catch(() => {});
    }
  }, [initial?.catalog_id]);

  const set = (key: keyof EquipmentFormData, value: string | null) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  const searchTransactions = async () => {
    if (!txSearch.trim()) return;
    setTxSearching(true);
    try {
      const res = await offlineFetch('/api/finance/transactions?limit=20');
      if (res.ok) {
        const d = await res.json();
        const q = txSearch.trim().toLowerCase();
        const filtered = (d.transactions || [])
          .filter((t: TransactionResult) => {
            const text = `${t.vendor || ''} ${t.amount} ${t.transaction_date}`.toLowerCase();
            return text.includes(q);
          })
          .slice(0, 8);
        setTxResults(filtered);
      }
    } finally {
      setTxSearching(false);
    }
  };

  const selectTransaction = (tx: TransactionResult) => {
    set('transaction_id', tx.id);
    setLinkedTxLabel(`${tx.vendor || 'Transaction'} $${Number(tx.amount).toFixed(2)} (${tx.transaction_date})`);
    setTxResults([]);
    setTxSearch('');
  };

  const unlinkTransaction = () => {
    set('transaction_id', null);
    setLinkedTxLabel(null);
  };

  const searchCatalog = async (q: string) => {
    if (!q.trim()) { setCatalogResults([]); return; }
    setCatalogSearching(true);
    try {
      const res = await offlineFetch(`/api/equipment/catalog?search=${encodeURIComponent(q)}`);
      if (res.ok) {
        const d = await res.json();
        setCatalogResults((d.catalog || []).slice(0, 8));
      }
    } finally {
      setCatalogSearching(false);
    }
  };

  const handleCatalogInput = (value: string) => {
    setCatalogSearch(value);
    if (catalogDebounce.current) clearTimeout(catalogDebounce.current);
    catalogDebounce.current = setTimeout(() => searchCatalog(value), 300);
  };

  const selectCatalogItem = (item: CatalogItem) => {
    set('catalog_id', item.id);
    set('name', item.name);
    set('brand', item.brand || '');
    set('model', item.model || '');
    setLinkedCatalogLabel(`${item.brand ? item.brand + ' ' : ''}${item.name}`);
    setCatalogResults([]);
    setCatalogSearch('');
  };

  const unlinkCatalog = () => {
    set('catalog_id', null);
    setLinkedCatalogLabel(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Catalog Search */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Search Equipment Catalog
          <span className="text-gray-400 font-normal ml-1">— optional, pre-fills name, brand &amp; model</span>
        </label>
        {form.catalog_id && linkedCatalogLabel ? (
          <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-sm text-sky-700">
            <span className="flex-1 truncate">From catalog: {linkedCatalogLabel}</span>
            <button
              type="button"
              onClick={unlinkCatalog}
              aria-label="Unlink catalog item"
              className="shrink-0"
            >
              <X className="w-4 h-4 text-sky-400 hover:text-sky-600" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => handleCatalogInput(e.target.value)}
                placeholder="Search: treadmill, barbell, kettlebell..."
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm"
              />
            </div>
            {catalogSearching && <p className="text-xs text-gray-400">Searching...</p>}
            {catalogResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {catalogResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectCatalogItem(item)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium">{item.brand ? `${item.brand} ` : ''}{item.name}</span>
                    {item.category && <span className="ml-2 text-gray-400">{item.category}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Name + Category row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Sony A7III"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
          <select
            value={form.category_id || ''}
            onChange={(e) => set('category_id', e.target.value || null)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Brand + Model */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Brand</label>
          <input
            type="text"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
          <input
            type="text"
            value={form.model}
            onChange={(e) => set('model', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Serial + Condition */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Serial Number</label>
          <input
            type="text"
            value={form.serial_number}
            onChange={(e) => set('serial_number', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Condition</label>
          <select
            value={form.condition}
            onChange={(e) => set('condition', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">--</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Purchase date + price + current value */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Date</label>
          <input
            type="date"
            value={form.purchase_date}
            onChange={(e) => set('purchase_date', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.purchase_price}
            onChange={(e) => set('purchase_price', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Current Value</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.current_value}
            onChange={(e) => set('current_value', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Warranty + Ownership */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Warranty Expires</label>
          <input
            type="date"
            value={form.warranty_expires}
            onChange={(e) => set('warranty_expires', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Ownership</label>
          <select
            value={form.ownership_type}
            onChange={(e) => set('ownership_type', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="own">I Own This</option>
            <option value="access">I Have Access</option>
          </select>
        </div>
      </div>

      {/* Linked Purchase Transaction */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Linked Purchase Transaction</label>
        {form.transaction_id && linkedTxLabel ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
            <span className="flex-1 truncate">{linkedTxLabel}</span>
            <button type="button" onClick={unlinkTransaction} className="shrink-0">
              <X className="w-4 h-4 text-green-500 hover:text-green-700" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchTransactions(); } }}
                placeholder="Search transactions by vendor..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={searchTransactions}
                disabled={txSearching}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            {txResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                {txResults.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => selectTransaction(tx)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    {tx.vendor || 'Transaction'} &middot; ${Number(tx.amount).toFixed(2)} &middot; {tx.transaction_date}
                  </button>
                ))}
              </div>
            )}
            {txSearching && <p className="text-xs text-gray-400">Searching...</p>}
          </div>
        )}
      </div>

      {/* Image */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Cover Photo / Video</label>
        <MediaUploader
          currentUrl={form.image_url || null}
          accept="image/*,video/*"
          label="Add photo or video"
          onUpload={(url) => set('image_url', url)}
          onRemove={() => { set('image_url', ''); set('image_public_id', ''); }}
        />
        <p className="text-[10px] text-gray-400 mt-1">Add more media (including audio) from the detail page after saving.</p>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
