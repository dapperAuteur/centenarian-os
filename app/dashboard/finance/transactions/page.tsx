'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Edit3, Filter, ChevronLeft, ChevronRight, Link2, X, Search, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import ActivityLinkModal from '@/components/ui/ActivityLinkModal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Brand {
  id: string;
  name: string;
  color: string;
}

interface Account {
  id: string;
  name: string;
  account_type: string;
  is_active: boolean;
  teller_account_id: string | null;
}

interface Transaction {
  id: string;
  amount: number;
  type: 'expense' | 'income';
  description: string | null;
  vendor: string | null;
  transaction_date: string;
  source: string;
  source_module: string | null;
  account_id: string | null;
  category_id: string | null;
  brand_id: string | null;
  budget_categories: Category | null;
  financial_accounts: { id: string; name: string } | null;
  notes: string | null;
  created_at: string;
}

const SOURCE_MODULE_BADGE: Record<string, { label: string; className: string }> = {
  fuel_log: { label: 'Fuel', className: 'bg-sky-50 text-sky-700' },
  vehicle_maintenance: { label: 'Maint.', className: 'bg-amber-50 text-amber-700' },
  trip: { label: 'Trip', className: 'bg-orange-50 text-orange-700' },
};

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  transfer: { label: 'Transfer', className: 'bg-indigo-50 text-indigo-700' },
  interest: { label: 'Interest', className: 'bg-red-50 text-red-700' },
  recurring: { label: 'Recurring', className: 'bg-teal-50 text-teal-700' },
};

const PAGE_SIZE = 25;

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlAccountId = searchParams.get('account_id') || '';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterAccountIds, setFilterAccountIds] = useState<Set<string>>(
    urlAccountId ? new Set([urlAccountId]) : new Set()
  );
  const [filterCategoryIds, setFilterCategoryIds] = useState<Set<string>>(new Set());
  const [filterBrandIds, setFilterBrandIds] = useState<Set<string>>(new Set());
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFilterCount = filterAccountIds.size + filterCategoryIds.size + filterBrandIds.size
    + (filterType ? 1 : 0) + (filterSource ? 1 : 0) + (filterFrom || filterTo ? 1 : 0);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkBrand, setBulkBrand] = useState('');
  const [bulkLifeTag, setBulkLifeTag] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [lifeCategories, setLifeCategories] = useState<{ id: string; name: string; color: string }[]>([]);

  // Edit inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(page * PAGE_SIZE));
    if (filterType) params.set('type', filterType);
    if (filterSource) params.set('source', filterSource);
    if (filterAccountIds.size > 0) params.set('account_ids', Array.from(filterAccountIds).join(','));
    if (filterCategoryIds.size > 0) params.set('category_ids', Array.from(filterCategoryIds).join(','));
    if (filterBrandIds.size > 0) params.set('brand_ids', Array.from(filterBrandIds).join(','));
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    if (filterSearch) params.set('q', filterSearch);

    try {
      const res = await offlineFetch(`/api/finance/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterSource, filterAccountIds, filterCategoryIds, filterBrandIds, filterFrom, filterTo, filterSearch]);

  useEffect(() => {
    Promise.all([
      offlineFetch('/api/finance/categories').then((r) => r.json()).then((d) => setCategories(d.categories || [])),
      offlineFetch('/api/brands').then((r) => r.json()).then((d) => setBrands(Array.isArray(d) ? d : [])),
      offlineFetch('/api/life-categories').then((r) => r.json()).then((d) => setLifeCategories(Array.isArray(d) ? d : (d.categories || []))),
      offlineFetch('/api/finance/accounts').then((r) => r.json()).then((d) => setAccounts(Array.isArray(d) ? d : [])),
    ]).catch(() => {});
  }, []);

  // Clear selection whenever filters or page change
  useEffect(() => { setSelected(new Set()); }, [page, filterType, filterSource, filterAccountIds, filterCategoryIds, filterBrandIds, filterFrom, filterTo, filterSearch]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    const res = await offlineFetch(`/api/finance/transactions?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchTransactions();
  };

  const handleEditSave = async (id: string) => {
    const res = await offlineFetch('/api/finance/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm }),
    });
    if (res.ok) {
      setEditId(null);
      fetchTransactions();
    }
  };

  const startEdit = (tx: Transaction) => {
    setEditId(tx.id);
    setEditForm({
      amount: String(tx.amount),
      description: tx.description || '',
      vendor: tx.vendor || '',
      transaction_date: tx.transaction_date,
      type: tx.type,
      category_id: tx.category_id || '',
      brand_id: tx.brand_id || '',
    });
  };

  const toggleFilterId = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setPage(0);
  };

  const clearAllFilters = () => {
    setFilterAccountIds(new Set());
    setFilterCategoryIds(new Set());
    setFilterBrandIds(new Set());
    setFilterType('');
    setFilterSource('');
    setFilterFrom('');
    setFilterTo('');
    setFilterSearch('');
    setPage(0);
    router.replace('/dashboard/finance/transactions');
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allPageSelected = transactions.length > 0 && transactions.every((tx) => selected.has(tx.id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelected((prev) => { const next = new Set(prev); transactions.forEach((tx) => next.delete(tx.id)); return next; });
    } else {
      setSelected((prev) => { const next = new Set(prev); transactions.forEach((tx) => next.add(tx.id)); return next; });
    }
  };

  const handleBulkApply = async () => {
    if (selected.size === 0 || (!bulkCategory && !bulkBrand && !bulkLifeTag)) return;
    setBulkSaving(true);
    setBulkResult(null);
    try {
      const ids = Array.from(selected);
      const updates: Record<string, string> = {};
      if (bulkCategory) updates.category_id = bulkCategory;
      if (bulkBrand) updates.brand_id = bulkBrand;
      const body: Record<string, unknown> = { ids };
      if (Object.keys(updates).length > 0) body.updates = updates;
      if (bulkLifeTag) body.life_category_id = bulkLifeTag;
      const res = await offlineFetch('/api/finance/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkResult(`Updated ${selected.size} transaction${selected.size !== 1 ? 's' : ''}`);
        setSelected(new Set());
        setBulkCategory('');
        setBulkBrand('');
        setBulkLifeTag('');
        fetchTransactions();
      } else {
        setBulkResult(data.error || 'Bulk update failed');
      }
    } finally {
      setBulkSaving(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/finance" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500">{total} total transactions</p>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from(filterAccountIds).map((id) => {
            const acct = accounts.find((a) => a.id === id);
            return (
              <button key={id} onClick={() => toggleFilterId(setFilterAccountIds, id)}
                className="flex items-center gap-1 text-xs bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 px-2.5 py-1 rounded-full hover:bg-fuchsia-100 transition">
                {acct?.name ?? 'Account'} <X className="w-3 h-3" />
              </button>
            );
          })}
          {Array.from(filterCategoryIds).map((id) => {
            const cat = categories.find((c) => c.id === id);
            return (
              <button key={id} onClick={() => toggleFilterId(setFilterCategoryIds, id)}
                className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full hover:bg-purple-100 transition">
                {cat?.name ?? 'Category'} <X className="w-3 h-3" />
              </button>
            );
          })}
          {Array.from(filterBrandIds).map((id) => {
            const brand = brands.find((b) => b.id === id);
            return (
              <button key={id} onClick={() => toggleFilterId(setFilterBrandIds, id)}
                className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full hover:bg-amber-100 transition">
                {brand?.name ?? 'Brand'} <X className="w-3 h-3" />
              </button>
            );
          })}
          {filterType && (
            <button onClick={() => { setFilterType(''); setPage(0); }}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full hover:bg-blue-100 transition">
              {filterType === 'expense' ? 'Expenses' : 'Income'} <X className="w-3 h-3" />
            </button>
          )}
          {filterSource && (
            <button onClick={() => { setFilterSource(''); setPage(0); }}
              className="flex items-center gap-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-full hover:bg-teal-100 transition">
              {filterSource === 'bank_sync' ? 'Bank Sync' : 'Manual'} <X className="w-3 h-3" />
            </button>
          )}
          {(filterFrom || filterTo) && (
            <button onClick={() => { setFilterFrom(''); setFilterTo(''); setPage(0); }}
              className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-full hover:bg-gray-200 transition">
              {filterFrom && filterTo ? `${filterFrom} – ${filterTo}` : filterFrom ? `From ${filterFrom}` : `To ${filterTo}`} <X className="w-3 h-3" />
            </button>
          )}
          <button onClick={clearAllFilters} className="text-xs text-gray-400 hover:text-gray-600 underline ml-1">Clear all</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            defaultValue={filterSearch}
            onChange={(e) => {
              const val = e.target.value;
              if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
              searchDebounceRef.current = setTimeout(() => { setFilterSearch(val); setPage(0); }, 300);
            }}
            placeholder="Search description, vendor, notes, amount…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700"
          />
        </div>

        {/* Quick filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {['', 'expense', 'income'].map((v) => (
              <button key={v} onClick={() => { setFilterType(v); setPage(0); }}
                className={`px-3 py-1.5 font-medium transition ${filterType === v ? 'bg-fuchsia-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {v === '' ? 'All' : v === 'expense' ? 'Expenses' : 'Income'}
              </button>
            ))}
          </div>
          {/* Source toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {[['', 'All Sources'], ['manual', 'Manual'], ['bank_sync', 'Bank Sync']].map(([v, label]) => (
              <button key={v} onClick={() => { setFilterSource(v); setPage(0); }}
                className={`px-3 py-1.5 font-medium transition ${filterSource === v ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>
          {/* Date range */}
          <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(0); }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-700" />
          <span className="text-gray-400 text-xs">–</span>
          <input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(0); }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-700" />
          {/* Toggle advanced */}
          <button onClick={() => setShowFilters((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition ml-auto ${showFilters ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Filter className="w-3.5 h-3.5" />
            Accounts / Categories
            {activeFilterCount > 0 && <span className="bg-fuchsia-600 text-white rounded-full px-1.5 text-[10px]">{activeFilterCount}</span>}
          </button>
        </div>

        {/* Advanced checkbox filters */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
            {/* Accounts */}
            {accounts.filter((a) => a.is_active).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accounts</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {accounts.filter((a) => a.is_active).map((acct) => (
                    <label key={acct.id} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={filterAccountIds.has(acct.id)}
                        onChange={() => toggleFilterId(setFilterAccountIds, acct.id)}
                        className="w-4 h-4 rounded border-gray-300 text-fuchsia-600 cursor-pointer" />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{acct.name}</span>
                      {acct.teller_account_id && <span className="text-[10px] text-teal-600">Sync</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categories</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={filterCategoryIds.has(cat.id)}
                        onChange={() => toggleFilterId(setFilterCategoryIds, cat.id)}
                        className="w-4 h-4 rounded border-gray-300 text-fuchsia-600 cursor-pointer" />
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* Brands */}
            {brands.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Brands</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {brands.map((brand) => (
                    <label key={brand.id} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={filterBrandIds.has(brand.id)}
                        onChange={() => toggleFilterId(setFilterBrandIds, brand.id)}
                        className="w-4 h-4 rounded border-gray-300 text-fuchsia-600 cursor-pointer" />
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: brand.color }} />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{brand.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-sky-800">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-xs text-sky-600 hover:text-sky-800 underline">Clear</button>
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-sky-200 rounded-lg bg-white text-gray-700"
            >
              <option value="">Set category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {brands.length > 0 && (
              <select
                value={bulkBrand}
                onChange={(e) => setBulkBrand(e.target.value)}
                className="px-2.5 py-1.5 text-sm border border-sky-200 rounded-lg bg-white text-gray-700"
              >
                <option value="">Set brand…</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {lifeCategories.length > 0 && (
              <select
                value={bulkLifeTag}
                onChange={(e) => setBulkLifeTag(e.target.value)}
                className="px-2.5 py-1.5 text-sm border border-sky-200 rounded-lg bg-white text-gray-700"
              >
                <option value="">Life tag…</option>
                {lifeCategories.map((lc) => <option key={lc.id} value={lc.id}>{lc.name}</option>)}
              </select>
            )}
            <button
              onClick={handleBulkApply}
              disabled={bulkSaving || (!bulkCategory && !bulkBrand && !bulkLifeTag)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition"
            >
              {bulkSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Apply
            </button>
          </div>
          {bulkResult && <span className="text-xs text-sky-700 font-medium">{bulkResult}</span>}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            No transactions found. Add one from the dashboard.
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y divide-gray-100">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-4">
                  {editId === tx.id ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                      />
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                        placeholder="Description"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleEditSave(tx.id)} className="px-3 py-1 bg-fuchsia-600 text-white rounded text-xs">Save</button>
                        <button onClick={() => setEditId(null)} className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(tx.id)}
                        onChange={() => toggleSelect(tx.id)}
                        aria-label="Select transaction"
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-sky-600 cursor-pointer shrink-0"
                      />
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => router.push(`/dashboard/finance/transactions/${tx.id}`)}
                      >
                        <p className="text-sm font-medium text-gray-900">{tx.description || tx.vendor || 'Transaction'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(tx.transaction_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {tx.financial_accounts?.name && <span className="ml-2 text-gray-400">{tx.financial_accounts.name}</span>}
                          {tx.budget_categories && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tx.budget_categories.color }} />
                              {tx.budget_categories.name}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                        </span>
                        <button onClick={() => startEdit(tx)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit">
                          <Edit3 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={() => handleDelete(tx.id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <table className="hidden sm:table w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="pl-4 pr-2 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all on page"
                      className="w-4 h-4 rounded border-gray-300 text-sky-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-gray-50 ${selected.has(tx.id) ? 'bg-sky-50' : ''} ${editId !== tx.id ? 'cursor-pointer' : ''}`}
                    onClick={() => { if (editId !== tx.id) router.push(`/dashboard/finance/transactions/${tx.id}`); }}
                  >
                    <td className="pl-4 pr-2 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(tx.id)}
                        onChange={() => toggleSelect(tx.id)}
                        aria-label={`Select transaction`}
                        className="w-4 h-4 rounded border-gray-300 text-sky-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {editId === tx.id ? (
                        <input
                          type="date"
                          value={editForm.transaction_date}
                          onChange={(e) => setEditForm((p) => ({ ...p, transaction_date: e.target.value }))}
                          className="px-2 py-1 text-xs border border-gray-300 rounded w-32 text-gray-900"
                        />
                      ) : (
                        new Date(tx.transaction_date + 'T12:00:00').toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {editId === tx.id ? (
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                          className="px-2 py-1 text-xs border border-gray-300 rounded w-full text-gray-900"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{tx.description || '-'}</span>
                          {tx.source_module && SOURCE_MODULE_BADGE[tx.source_module] && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SOURCE_MODULE_BADGE[tx.source_module].className}`}>
                              {SOURCE_MODULE_BADGE[tx.source_module].label}
                            </span>
                          )}
                          {tx.source && SOURCE_BADGE[tx.source] && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SOURCE_BADGE[tx.source].className}`}>
                              {SOURCE_BADGE[tx.source].label}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {editId === tx.id ? (
                        <input
                          type="text"
                          value={editForm.vendor}
                          onChange={(e) => setEditForm((p) => ({ ...p, vendor: e.target.value }))}
                          className="px-2 py-1 text-xs border border-gray-300 rounded w-full text-gray-900"
                        />
                      ) : (
                        tx.vendor || '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {tx.financial_accounts?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      {editId === tx.id ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={editForm.category_id}
                            onChange={(e) => setEditForm((p) => ({ ...p, category_id: e.target.value }))}
                            className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-900"
                          >
                            <option value="">No category</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          {brands.length > 0 && (
                            <select
                              value={editForm.brand_id}
                              onChange={(e) => setEditForm((p) => ({ ...p, brand_id: e.target.value }))}
                              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-900"
                            >
                              <option value="">No brand</option>
                              {brands.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : tx.budget_categories ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tx.budget_categories.color }} />
                          {tx.budget_categories.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {editId === tx.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                          className="px-2 py-1 text-xs border border-gray-300 rounded w-24 text-right text-gray-900"
                        />
                      ) : (
                        <span className={`font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {editId === tx.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEditSave(tx.id)} className="px-2 py-1 bg-fuchsia-600 text-white rounded text-xs">Save</button>
                          <button onClick={() => setEditId(null)} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => startEdit(tx)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition" title="Edit">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setLinkingId(tx.id)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:bg-sky-50 hover:text-sky-700 rounded-lg transition" title="Link activities">
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(tx.id)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-sm text-gray-500">
            Page {page + 1} of {totalPages} &middot; {total} transactions
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ActivityLinkModal
        isOpen={!!linkingId}
        onClose={() => setLinkingId(null)}
        entityType="transaction"
        entityId={linkingId || ''}
        title="Link Transaction"
      />
    </div>
  );
}
