'use client';

// app/dashboard/finance/brands/page.tsx
// Brand management: list, add, edit, toggle active/inactive, delete
// Per-brand P&L with date range filter and PDF export

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, Pencil, Trash2, BarChart2, Download, X } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  dba_name: string | null;
  ein: string | null;
  address: string | null;
  website: string | null;
  color: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Transaction {
  id: string;
  transaction_date: string;
  description: string | null;
  vendor: string | null;
  amount: number;
  type: 'income' | 'expense';
}

interface PLData {
  brand: Brand;
  income: number;
  expenses: number;
  net: number;
  transactions: Transaction[];
}

const BLANK_FORM = {
  name: '',
  dba_name: '',
  ein: '',
  address: '',
  website: '',
  color: '#6366f1',
  description: '',
};

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6'];

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  // P&L state
  const [plBrand, setPlBrand] = useState<Brand | null>(null);
  const [plData, setPlData] = useState<PLData | null>(null);
  const [plFrom, setPlFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [plTo, setPlTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [plLoading, setPlLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/brands');
      if (res.ok) setBrands(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm(BLANK_FORM);
    setShowForm(true);
  };

  const openEdit = (b: Brand) => {
    setEditingId(b.id);
    setForm({
      name: b.name,
      dba_name: b.dba_name ?? '',
      ein: b.ein ?? '',
      address: b.address ?? '',
      website: b.website ?? '',
      color: b.color,
      description: b.description ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        dba_name: form.dba_name || null,
        ein: form.ein || null,
        address: form.address || null,
        website: form.website || null,
        color: form.color,
        description: form.description || null,
      };
      const res = editingId
        ? await fetch(`/api/brands/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/brands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (res.ok) {
        setShowForm(false);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (b: Brand) => {
    await fetch(`/api/brands/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !b.is_active }),
    });
    load();
  };

  const handleDelete = async (b: Brand) => {
    if (!confirm(`Delete brand "${b.name}"? This will unlink any assigned transactions.`)) return;
    await fetch(`/api/brands/${b.id}`, { method: 'DELETE' });
    load();
  };

  // P&L
  const openPL = (b: Brand) => {
    setPlBrand(b);
    setPlData(null);
    loadPL(b.id, plFrom, plTo);
  };

  const loadPL = useCallback(async (brandId: string, from: string, to: string) => {
    setPlLoading(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/pl?from=${from}&to=${to}`);
      if (res.ok) setPlData(await res.json());
    } finally {
      setPlLoading(false);
    }
  }, []);

  const handlePLFilter = () => {
    if (plBrand) loadPL(plBrand.id, plFrom, plTo);
  };

  const handleExportPDF = async () => {
    if (!plData) return;
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const { brand, income, expenses, net, transactions } = plData;

    let y = 20;
    doc.setFontSize(18);
    doc.text(brand.name, 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(100);
    if (brand.dba_name) { doc.text(`DBA: ${brand.dba_name}`, 14, y); y += 6; }
    if (brand.ein) { doc.text(`EIN: ${brand.ein}`, 14, y); y += 6; }
    if (brand.address) { doc.text(`Address: ${brand.address}`, 14, y); y += 6; }
    doc.text(`Period: ${plFrom} to ${plTo}`, 14, y); y += 10;

    // Summary
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text('Summary', 14, y); y += 7;
    doc.setFontSize(10);
    doc.text(`Income:    ${fmtMoney(income)}`, 14, y); y += 6;
    doc.text(`Expenses:  ${fmtMoney(expenses)}`, 14, y); y += 6;
    doc.text(`Net:       ${fmtMoney(net)}`, 14, y); y += 12;

    // Transactions table header
    doc.setFontSize(12);
    doc.text('Transactions', 14, y); y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 14, y);
    doc.text('Description', 44, y);
    doc.text('Vendor', 110, y);
    doc.text('Type', 155, y);
    doc.text('Amount', 175, y);
    y += 5;
    doc.setFont('helvetica', 'normal');

    for (const tx of transactions) {
      if (y > 270) { doc.addPage(); y = 20; }
      const desc = (tx.description ?? '').substring(0, 35);
      const vendor = (tx.vendor ?? '').substring(0, 25);
      doc.text(tx.transaction_date, 14, y);
      doc.text(desc, 44, y);
      doc.text(vendor, 110, y);
      doc.text(tx.type, 155, y);
      doc.text(fmtMoney(tx.amount), 175, y);
      y += 5;
    }

    doc.save(`${brand.name.replace(/\s+/g, '_')}_PL_${plFrom}_${plTo}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance" className="text-gray-400 hover:text-gray-600 transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
            <p className="text-sm text-gray-500">Allocate expenses to businesses you manage</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Brand
        </button>
      </div>

      {/* Brand List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-7 w-7 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : brands.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">
          <p className="text-gray-400 text-sm">No brands yet.</p>
          <p className="text-gray-400 text-xs mt-1">Add a brand to start allocating expenses for P&L reporting.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {brands.map((b) => (
            <div
              key={b.id}
              className={`bg-white border rounded-2xl p-5 flex items-center justify-between transition ${
                b.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: b.color }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{b.name}</span>
                    {b.dba_name && (
                      <span className="text-xs text-gray-400">dba {b.dba_name}</span>
                    )}
                    {!b.is_active && (
                      <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">inactive</span>
                    )}
                  </div>
                  {b.ein && <p className="text-xs text-gray-400 mt-0.5">EIN: {b.ein}</p>}
                  {b.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{b.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={() => openPL(b)}
                  title="View P&L"
                  className="p-1.5 text-gray-400 hover:text-indigo-600 transition"
                >
                  <BarChart2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleActive(b)}
                  className={`text-xs px-2 py-1 rounded-lg border transition ${
                    b.is_active
                      ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      : 'border-green-200 text-green-600 hover:bg-green-50'
                  }`}
                >
                  {b.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => openEdit(b)}
                  className="p-1.5 text-gray-400 hover:text-sky-600 transition"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(b)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Brand' : 'Add Brand'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Business Name *</label>
              <input
                type="text" value={form.name} required
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Acme LLC"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">DBA Name</label>
                <input
                  type="text" value={form.dba_name}
                  onChange={(e) => setForm((f) => ({ ...f, dba_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Trade name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">EIN</label>
                <input
                  type="text" value={form.ein}
                  onChange={(e) => setForm((f) => ({ ...f, ein: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="12-3456789"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <input
                type="text" value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="123 Main St, City, ST 12345"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
              <input
                type="text" value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Optional description"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-600' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color" value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-7 h-7 rounded cursor-pointer border border-gray-200"
                  title="Custom color"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update Brand' : 'Create Brand'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* P&L Modal */}
      {plBrand && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            {/* P&L Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: plBrand.color }} />
                <div>
                  <h2 className="text-base font-bold text-gray-900">{plBrand.name} — P&L</h2>
                  {plBrand.ein && <p className="text-xs text-gray-400">EIN: {plBrand.ein}</p>}
                </div>
              </div>
              <button onClick={() => { setPlBrand(null); setPlData(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date range filter */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
              <input
                type="date" value={plFrom}
                onChange={(e) => setPlFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date" value={plTo}
                onChange={(e) => setPlTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                onClick={handlePLFilter}
                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
              >
                Apply
              </button>
              {plData && (
                <button
                  onClick={handleExportPDF}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
              )}
            </div>

            {/* P&L Content */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {plLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin h-6 w-6 border-4 border-indigo-600 border-t-transparent rounded-full" />
                </div>
              ) : plData ? (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                      <p className="text-xs text-green-600 font-medium mb-1">Income</p>
                      <p className="text-lg font-bold text-green-700">{fmtMoney(plData.income)}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                      <p className="text-xs text-red-500 font-medium mb-1">Expenses</p>
                      <p className="text-lg font-bold text-red-600">{fmtMoney(plData.expenses)}</p>
                    </div>
                    <div className={`border rounded-xl p-4 text-center ${plData.net >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100'}`}>
                      <p className={`text-xs font-medium mb-1 ${plData.net >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>Net</p>
                      <p className={`text-lg font-bold ${plData.net >= 0 ? 'text-indigo-700' : 'text-orange-600'}`}>{fmtMoney(plData.net)}</p>
                    </div>
                  </div>

                  {/* Transaction list */}
                  {plData.transactions.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-8">No transactions for this period.</p>
                  ) : (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <tr>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-left">Description</th>
                            <th className="px-4 py-3 text-left">Vendor</th>
                            <th className="px-4 py-3 text-left">Type</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {plData.transactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{tx.transaction_date}</td>
                              <td className="px-4 py-2.5 text-gray-800 max-w-40 truncate">{tx.description ?? '—'}</td>
                              <td className="px-4 py-2.5 text-gray-500">{tx.vendor ?? '—'}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${tx.type === 'income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                  {tx.type}
                                </span>
                              </td>
                              <td className={`px-4 py-2.5 text-right font-medium ${tx.type === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                                {tx.type === 'expense' ? '-' : ''}{fmtMoney(tx.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
