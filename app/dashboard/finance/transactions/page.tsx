'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Edit3, Filter, ChevronLeft, ChevronRight, Link2, X, Search, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import ActivityLinkModal from '@/components/ui/ActivityLinkModal';
import LearnCategoryPrompt, { type LearnCategoryRequest } from '@/components/finance/LearnCategoryPrompt';
import PossibleTransfersPanel from '@/components/finance/PossibleTransfersPanel';
import DeleteTransferDialog from '@/components/finance/DeleteTransferDialog';
import TransferBadge, { type TransferPartnerView } from '@/components/finance/TransferBadge';
import { accountLabel } from '@/lib/finance/transfers/pairing';
import { offlineFetch, isQueuedResponse } from '@/lib/offline/offline-fetch';
import { vendorKey } from '@/lib/finance/transaction-matching';
import TxAmount from '@/components/finance/TxAmount';

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
  institution_name?: string | null;
  last_four?: string | null;
  is_active: boolean;
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
  financial_accounts: { id: string; name: string; institution_name?: string | null; last_four?: string | null; currency?: string | null } | null;
  // Multi-currency (migration 210): absent before it. currency null = the account's currency.
  currency?: string | null;
  amount_home?: number | null;
  notes: string | null;
  created_at: string;
  // Set when the row is one side of a transfer. Absent on a database that
  // doesn't have the transfer columns yet.
  transfer_group_id?: string | null;
  transfer_partner?: TransferPartnerView | null;
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
  // Two links the statement import screen uses:
  //   ?batch=<import_batch_id>  lists the transactions of one import
  //   ?review=transfers         opens the "Possible transfers" panel
  const urlBatchId = searchParams.get('batch') || '';
  // The Budgets page links here with ?uncategorized=1&from=&to= (one month's uncategorized spending).
  const urlUncategorized = searchParams.get('uncategorized') === '1';
  const reviewTransfers = searchParams.get('review') === 'transfers';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [homeCurrency, setHomeCurrency] = useState('USD');
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>(() => searchParams.get('type') || '');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterAccountIds, setFilterAccountIds] = useState<Set<string>>(
    urlAccountId ? new Set([urlAccountId]) : new Set()
  );
  const [filterCategoryIds, setFilterCategoryIds] = useState<Set<string>>(new Set());
  const [filterBrandIds, setFilterBrandIds] = useState<Set<string>>(new Set());
  const [filterFrom, setFilterFrom] = useState<string>(() => searchParams.get('from') || '');
  const [filterTo, setFilterTo] = useState<string>(() => searchParams.get('to') || '');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFilterCount = filterAccountIds.size + filterCategoryIds.size + filterBrandIds.size
    + (filterType ? 1 : 0) + (filterSource ? 1 : 0) + (filterFrom || filterTo ? 1 : 0) + (urlBatchId ? 1 : 0) + (urlUncategorized ? 1 : 0);

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
  // "Always categorize this vendor as ...?" prompt after an edit or bulk change
  const [learnPrompt, setLearnPrompt] = useState<{ id: number; request: LearnCategoryRequest } | null>(null);
  // Why the last save or delete was refused (one side of a transfer, for example).
  const [actionError, setActionError] = useState<string | null>(null);
  // Deleting one side of a transfer asks what to do with the other side.
  const [pairDelete, setPairDelete] = useState<{ id: string; partner: TransferPartnerView | null } | null>(null);
  // Bumped after a delete, so the "Possible transfers" panel checks again.
  const [transfersVersion, setTransfersVersion] = useState(0);
  // Something the server wants said about the list (the import filter can't be applied, say).
  const [listNotice, setListNotice] = useState<string | null>(null);

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
    if (urlBatchId) params.set('batch', urlBatchId);
    if (urlUncategorized) params.set('uncategorized', '1');

    try {
      const res = await offlineFetch(`/api/finance/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        if (typeof data.home_currency === 'string') setHomeCurrency(data.home_currency);
        setTotal(data.total || 0);
        setListNotice(typeof data.notice === 'string' ? data.notice : null);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterSource, filterAccountIds, filterCategoryIds, filterBrandIds, filterFrom, filterTo, filterSearch, urlBatchId, urlUncategorized]);

  useEffect(() => {
    Promise.all([
      offlineFetch('/api/finance/categories').then((r) => r.json()).then((d) => setCategories(d.categories || [])),
      offlineFetch('/api/brands').then((r) => r.json()).then((d) => setBrands(Array.isArray(d) ? d : [])),
      offlineFetch('/api/life-categories').then((r) => r.json()).then((d) => setLifeCategories(Array.isArray(d) ? d : (d.categories || []))),
      offlineFetch('/api/finance/accounts').then((r) => r.json()).then((d) => setAccounts(Array.isArray(d) ? d : [])),
    ]).catch(() => {});
  }, []);

  // Clear selection whenever filters or page change
  useEffect(() => { setSelected(new Set()); }, [page, filterType, filterSource, filterAccountIds, filterCategoryIds, filterBrandIds, filterFrom, filterTo, filterSearch, urlBatchId, urlUncategorized]);

  // A different import (or none) starts from its first page.
  useEffect(() => { setPage(0); }, [urlBatchId, urlUncategorized]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleDelete = async (tx: Transaction) => {
    setActionError(null);
    // One side of a transfer: choose between deleting both sides and unlinking first.
    if (tx.transfer_group_id && tx.transfer_partner) {
      setPairDelete({ id: tx.id, partner: tx.transfer_partner });
      return;
    }
    if (!confirm('Delete this transaction?')) return;
    const res = await offlineFetch(`/api/finance/transactions?id=${tx.id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchTransactions();
      setTransfersVersion((v) => v + 1);
      return;
    }
    const data = await res.json().catch(() => null);
    // The server found a transfer this list didn't know about yet.
    if (res.status === 409 && data?.transfer_group_id) setPairDelete({ id: tx.id, partner: data.partner ?? null });
    else setActionError(typeof data?.error === 'string' ? data.error : 'Delete failed. Please try again.');
  };

  const handleEditSave = async (id: string) => {
    const original = transactions.find((tx) => tx.id === id);
    setActionError(null);
    const res = await offlineFetch('/api/finance/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm }),
    });
    if (!res.ok) {
      // Said out loud: a refused edit (one side of a transfer, say) used to fail silently.
      const data = await res.json().catch(() => null);
      setActionError(typeof data?.error === 'string' ? data.error : 'The change could not be saved. Please try again.');
      return;
    }
    // The category was set or changed: offer to remember it for this vendor.
    const categoryId = editForm.category_id || '';
    const vendor = (editForm.vendor || '').trim();
    if (!isQueuedResponse(res) && categoryId && vendor && categoryId !== (original?.category_id || '')) {
      setLearnPrompt({
        id: Date.now(),
        request: { vendor, type: editForm.type === 'income' ? 'income' : 'expense', categoryId },
      });
    }
    setEditId(null);
    fetchTransactions();
  };

  const startEdit = (tx: Transaction) => {
    setActionError(null);
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

  // Drops one address filter (?batch= or ?uncategorized=), keeping whatever else is there.
  const clearUrlFilter = (name: 'batch' | 'uncategorized') => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(name);
    const query = next.toString();
    router.replace(`/dashboard/finance/transactions${query ? `?${query}` : ''}`);
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
        // Every selected row is from one vendor: offer to remember the category.
        if (bulkCategory && !isQueuedResponse(res)) {
          const rows = transactions.filter((tx) => selected.has(tx.id));
          const keys = new Set(rows.map((tx) => vendorKey(tx.vendor)));
          const types = new Set(rows.map((tx) => tx.type));
          if (rows.length > 0 && keys.size === 1 && !keys.has('') && types.size === 1) {
            setLearnPrompt({
              id: Date.now(),
              request: { vendor: (rows[0].vendor ?? '').trim(), type: rows[0].type, categoryId: bulkCategory },
            });
          }
        }
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
                className="flex items-center gap-1 text-xs bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 min-h-11 px-3 rounded-full hover:bg-fuchsia-100 transition">
                {acct ? accountLabel(acct) : 'Account'} <X className="w-3 h-3" />
              </button>
            );
          })}
          {urlBatchId && (
            <button onClick={() => clearUrlFilter('batch')}
              aria-label="Remove the filter: transactions from one import"
              className="flex items-center gap-1 text-xs bg-sky-50 text-sky-800 border border-sky-200 min-h-11 px-3 rounded-full hover:bg-sky-100 transition">
              From one import <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          {urlUncategorized && (
            <button onClick={() => clearUrlFilter('uncategorized')}
              aria-label="Remove the filter: uncategorized only"
              className="flex items-center gap-1 text-xs bg-sky-50 text-sky-800 border border-sky-200 min-h-11 px-3 rounded-full hover:bg-sky-100 transition">
              Uncategorized only <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          {Array.from(filterCategoryIds).map((id) => {
            const cat = categories.find((c) => c.id === id);
            return (
              <button key={id} onClick={() => toggleFilterId(setFilterCategoryIds, id)}
                className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 min-h-11 px-3 rounded-full hover:bg-purple-100 transition">
                {cat?.name ?? 'Category'} <X className="w-3 h-3" />
              </button>
            );
          })}
          {Array.from(filterBrandIds).map((id) => {
            const brand = brands.find((b) => b.id === id);
            return (
              <button key={id} onClick={() => toggleFilterId(setFilterBrandIds, id)}
                className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 min-h-11 px-3 rounded-full hover:bg-amber-100 transition">
                {brand?.name ?? 'Brand'} <X className="w-3 h-3" />
              </button>
            );
          })}
          {filterType && (
            <button onClick={() => { setFilterType(''); setPage(0); }}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 min-h-11 px-3 rounded-full hover:bg-blue-100 transition">
              {filterType === 'expense' ? 'Expenses' : 'Income'} <X className="w-3 h-3" />
            </button>
          )}
          {filterSource && (
            <button onClick={() => { setFilterSource(''); setPage(0); }}
              className="flex items-center gap-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 min-h-11 px-3 rounded-full hover:bg-teal-100 transition">
              {filterSource === 'bank_sync' ? 'Bank import' : 'Manual'} <X className="w-3 h-3" />
            </button>
          )}
          {(filterFrom || filterTo) && (
            <button onClick={() => { setFilterFrom(''); setFilterTo(''); setPage(0); }}
              className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 border border-gray-200 min-h-11 px-3 rounded-full hover:bg-gray-200 transition">
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
          {/* Source toggle. 'bank_sync' is the stored value on historic rows from the
              removed bank-linking integration; it is shown as "Bank import". */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {[['', 'All Sources'], ['manual', 'Manual'], ['bank_sync', 'Bank import']].map(([v, label]) => (
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
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{accountLabel(acct)}</span>
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

      {/* Possible transfers between the person's own accounts */}
      <PossibleTransfersPanel
        refreshKey={transfersVersion}
        from={filterFrom || undefined}
        to={filterTo || undefined}
        requested={reviewTransfers}
        onChanged={fetchTransactions}
      />

      {listNotice && (
        <p role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          {listNotice}
        </p>
      )}

      {actionError && (
        <p role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {actionError}
        </p>
      )}

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

      {learnPrompt && (
        <LearnCategoryPrompt
          key={learnPrompt.id}
          {...learnPrompt.request}
          categoryName={categories.find((c) => c.id === learnPrompt.request.categoryId)?.name ?? 'this category'}
          onClose={() => setLearnPrompt(null)}
          onPastApplied={fetchTransactions}
        />
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
                        aria-label="Amount"
                        disabled={Boolean(tx.transfer_group_id)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                      />
                      {tx.transfer_group_id && (
                        <p className="text-xs text-gray-600">
                          Part of a transfer: the amount is locked so both sides keep matching. Unlink it on the
                          transaction&rsquo;s page to change it.
                        </p>
                      )}
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                        placeholder="Description"
                      />
                      <label htmlFor={`edit-category-${tx.id}`} className="sr-only">Category</label>
                      <select
                        id={`edit-category-${tx.id}`}
                        value={editForm.category_id}
                        onChange={(e) => setEditForm((p) => ({ ...p, category_id: e.target.value }))}
                        className="w-full min-h-11 px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                      >
                        <option value="">No category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
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
                          {tx.financial_accounts?.name && <span className="ml-2 text-gray-500">{accountLabel(tx.financial_accounts)}</span>}
                          {tx.budget_categories && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tx.budget_categories.color }} />
                              {tx.budget_categories.name}
                            </span>
                          )}
                        </p>
                        {tx.transfer_group_id && (
                          <TransferBadge partner={tx.transfer_partner} className="mt-1" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <TxAmount tx={tx} homeCurrency={homeCurrency} className="text-sm font-semibold" />
                        <button
                          onClick={() => startEdit(tx)}
                          className="min-h-11 min-w-11 flex items-center justify-center hover:bg-gray-100 rounded-lg"
                          title="Edit"
                          aria-label={`Edit ${tx.description || tx.vendor || 'transaction'}`}
                        >
                          <Edit3 className="w-4 h-4 text-gray-500" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx)}
                          className="min-h-11 min-w-11 flex items-center justify-center hover:bg-red-50 rounded-lg"
                          title="Delete"
                          aria-label={`Delete ${tx.description || tx.vendor || 'transaction'}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" aria-hidden="true" />
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
                          {/* A linked row gets the transfer badge; the plain source badge is for the rest. */}
                          {tx.source && SOURCE_BADGE[tx.source] && !tx.transfer_group_id && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SOURCE_BADGE[tx.source].className}`}>
                              {SOURCE_BADGE[tx.source].label}
                            </span>
                          )}
                          {tx.transfer_group_id && <TransferBadge partner={tx.transfer_partner} />}
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
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {tx.financial_accounts ? accountLabel(tx.financial_accounts) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {editId === tx.id ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={editForm.category_id}
                            onChange={(e) => setEditForm((p) => ({ ...p, category_id: e.target.value }))}
                            aria-label="Category"
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
                          aria-label="Amount"
                          disabled={Boolean(tx.transfer_group_id)}
                          title={tx.transfer_group_id ? 'Part of a transfer: unlink it to change the amount' : undefined}
                          className="px-2 py-1 text-xs border border-gray-300 rounded w-24 text-right text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      ) : (
                        <TxAmount tx={tx} homeCurrency={homeCurrency} className="font-medium" />
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
                          <button onClick={() => startEdit(tx)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition" title="Edit" aria-label={`Edit ${tx.description || tx.vendor || 'transaction'}`}>
                            <Edit3 className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button onClick={() => setLinkingId(tx.id)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:bg-sky-50 hover:text-sky-700 rounded-lg transition" title="Link activities" aria-label={`Link activities to ${tx.description || tx.vendor || 'transaction'}`}>
                            <Link2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button onClick={() => handleDelete(tx)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition" title="Delete" aria-label={`Delete ${tx.description || tx.vendor || 'transaction'}`}>
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
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

      <DeleteTransferDialog
        transactionId={pairDelete?.id ?? null}
        partner={pairDelete?.partner ?? null}
        onClose={() => setPairDelete(null)}
        onDeleted={() => {
          setPairDelete(null);
          fetchTransactions();
          setTransfersVersion((v) => v + 1);
        }}
      />

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
