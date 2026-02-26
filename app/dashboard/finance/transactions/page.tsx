'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Trash2, Edit3, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

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

interface Transaction {
  id: string;
  amount: number;
  type: 'expense' | 'income';
  description: string | null;
  vendor: string | null;
  transaction_date: string;
  source: string;
  source_module: string | null;
  category_id: string | null;
  brand_id: string | null;
  budget_categories: Category | null;
  notes: string | null;
  created_at: string;
}

const SOURCE_MODULE_BADGE: Record<string, { label: string; className: string }> = {
  fuel_log: { label: 'Fuel', className: 'bg-sky-50 text-sky-700' },
  vehicle_maintenance: { label: 'Maint.', className: 'bg-amber-50 text-amber-700' },
  trip: { label: 'Trip', className: 'bg-orange-50 text-orange-700' },
};

const PAGE_SIZE = 25;

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');

  // Edit inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(page * PAGE_SIZE));
    if (filterType) params.set('type', filterType);
    if (filterCategory) params.set('category_id', filterCategory);
    if (filterBrand) params.set('brand_id', filterBrand);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);

    try {
      const res = await fetch(`/api/finance/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterCategory, filterBrand, filterFrom, filterTo]);

  useEffect(() => {
    Promise.all([
      fetch('/api/finance/categories').then((r) => r.json()).then((d) => setCategories(d.categories || [])),
      fetch('/api/brands').then((r) => r.json()).then((d) => setBrands(Array.isArray(d) ? d : [])),
    ]).catch(() => {});
  }, []);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    const res = await fetch(`/api/finance/transactions?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchTransactions();
  };

  const handleEditSave = async (id: string) => {
    const res = await fetch('/api/finance/transactions', {
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

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            <option value="">All Types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterBrand}
            onChange={(e) => { setFilterBrand(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => { setFilterFrom(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
            placeholder="From"
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => { setFilterTo(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
            placeholder="To"
          />
        </div>
      </div>

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
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border rounded"
                        placeholder="Description"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleEditSave(tx.id)} className="px-3 py-1 bg-fuchsia-600 text-white rounded text-xs">Save</button>
                        <button onClick={() => setEditId(null)} className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{tx.description || tx.vendor || 'Transaction'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(tx.transaction_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                        <button onClick={() => startEdit(tx)} className="p-1 hover:bg-gray-100 rounded">
                          <Edit3 className="w-3 h-3 text-gray-400" />
                        </button>
                        <button onClick={() => handleDelete(tx.id)} className="p-1 hover:bg-red-50 rounded">
                          <Trash2 className="w-3 h-3 text-red-400" />
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
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {editId === tx.id ? (
                        <input
                          type="date"
                          value={editForm.transaction_date}
                          onChange={(e) => setEditForm((p) => ({ ...p, transaction_date: e.target.value }))}
                          className="px-2 py-1 text-xs border rounded w-32"
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
                          className="px-2 py-1 text-xs border rounded w-full"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{tx.description || '-'}</span>
                          {tx.source_module && SOURCE_MODULE_BADGE[tx.source_module] && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SOURCE_MODULE_BADGE[tx.source_module].className}`}>
                              {SOURCE_MODULE_BADGE[tx.source_module].label}
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
                          className="px-2 py-1 text-xs border rounded w-full"
                        />
                      ) : (
                        tx.vendor || '-'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editId === tx.id ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={editForm.category_id}
                            onChange={(e) => setEditForm((p) => ({ ...p, category_id: e.target.value }))}
                            className="px-2 py-1 text-xs border rounded"
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
                              className="px-2 py-1 text-xs border rounded"
                            >
                              <option value="">No brand</option>
                              {brands.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : tx.budget_categories ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
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
                          className="px-2 py-1 text-xs border rounded w-24 text-right"
                        />
                      ) : (
                        <span className={`font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editId === tx.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEditSave(tx.id)} className="px-2 py-1 bg-fuchsia-600 text-white rounded text-xs">Save</button>
                          <button onClick={() => setEditId(null)} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEdit(tx)} className="p-1.5 hover:bg-gray-100 rounded-lg transition" title="Edit">
                            <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button onClick={() => handleDelete(tx.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition" title="Delete">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
