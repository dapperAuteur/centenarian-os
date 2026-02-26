'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar,
} from 'recharts';
import { Camera, Plus, Loader2, ChevronLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';

interface FuelLog {
  id: string;
  date: string;
  odometer_miles: number | null;
  miles_since_last_fill: number | null;
  miles_this_month: number | null;
  mpg_display: number | null;
  mpg_calculated: number | null;
  gallons: number | null;
  total_cost: number | null;
  cost_per_gallon: number | null;
  fuel_grade: string | null;
  station: string | null;
  source: string;
  vehicles?: { id: string; nickname: string; type: string } | null;
}

interface Vehicle {
  id: string;
  nickname: string;
  type: string;
}

interface FinanceCategory {
  id: string;
  name: string;
  color: string;
}

const BLANK_FORM = {
  vehicle_id: '',
  date: new Date().toISOString().split('T')[0],
  odometer_miles: '',
  miles_since_last_fill: '',
  miles_this_month: '',
  mpg_display: '',
  gallons: '',
  total_cost: '',
  cost_per_gallon: '',
  fuel_grade: 'regular',
  station: '',
  notes: '',
  finance_category_id: '',
};

function fmt(n: number | null | undefined, d = 1) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function FuelLogPage() {
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrNotes, setOcrNotes] = useState('');
  const [linkedTxDialog, setLinkedTxDialog] = useState<{ transactionId: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, vehiclesRes, catRes] = await Promise.all([
        fetch('/api/travel/fuel?limit=100'),
        fetch('/api/travel/vehicles'),
        fetch('/api/finance/categories'),
      ]);
      if (logsRes.ok) {
        const d = await logsRes.json();
        setLogs(d.logs || []);
        setTotal(d.total || 0);
      }
      if (vehiclesRes.ok) {
        const d = await vehiclesRes.json();
        setVehicles((d.vehicles || []).filter((v: Vehicle & { type: string }) =>
          v.type === 'car' || v.type === 'motorcycle'
        ));
      }
      if (catRes.ok) {
        const d = await catRes.json();
        setFinanceCategories(d.categories || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOcr = async (files: FileList) => {
    if (!files.length) return;
    setOcrLoading(true);
    setOcrNotes('');
    try {
      const fd = new FormData();
      for (let i = 0; i < Math.min(files.length, 4); i++) {
        fd.append('images', files[i]);
      }
      const res = await fetch('/api/travel/fuel/ocr', { method: 'POST', body: fd });
      if (!res.ok) { setOcrNotes('OCR failed — fill in manually'); return; }
      const { extracted } = await res.json();
      setForm((f) => ({
        ...f,
        date: extracted.date ?? f.date,
        odometer_miles: extracted.odometer_miles != null ? String(extracted.odometer_miles) : f.odometer_miles,
        miles_since_last_fill: extracted.miles_since_last_fill != null ? String(extracted.miles_since_last_fill) : f.miles_since_last_fill,
        miles_this_month: extracted.miles_this_month != null ? String(extracted.miles_this_month) : f.miles_this_month,
        mpg_display: extracted.mpg_display != null ? String(extracted.mpg_display) : f.mpg_display,
        gallons: extracted.gallons != null ? String(extracted.gallons) : f.gallons,
        total_cost: extracted.total_cost != null ? String(extracted.total_cost) : f.total_cost,
        cost_per_gallon: extracted.cost_per_gallon != null ? String(extracted.cost_per_gallon) : f.cost_per_gallon,
        fuel_grade: extracted.fuel_grade ?? f.fuel_grade,
        station: extracted.station ?? f.station,
      }));
      setOcrNotes(extracted.confidence_notes ?? 'Review the extracted values below.');
      setShowForm(true);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleEdit = (log: FuelLog) => {
    setEditingId(log.id);
    setForm({
      vehicle_id: log.vehicles?.id ?? '',
      date: log.date,
      odometer_miles: log.odometer_miles != null ? String(log.odometer_miles) : '',
      miles_since_last_fill: log.miles_since_last_fill != null ? String(log.miles_since_last_fill) : '',
      miles_this_month: log.miles_this_month != null ? String(log.miles_this_month) : '',
      mpg_display: log.mpg_display != null ? String(log.mpg_display) : '',
      gallons: log.gallons != null ? String(log.gallons) : '',
      total_cost: log.total_cost != null ? String(log.total_cost) : '',
      cost_per_gallon: log.cost_per_gallon != null ? String(log.cost_per_gallon) : '',
      fuel_grade: log.fuel_grade ?? 'regular',
      station: log.station ?? '',
      notes: '',
      finance_category_id: '',
    });
    setOcrNotes('');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        vehicle_id: form.vehicle_id || null,
        date: form.date,
        odometer_miles: form.odometer_miles ? parseFloat(form.odometer_miles) : null,
        miles_since_last_fill: form.miles_since_last_fill ? parseFloat(form.miles_since_last_fill) : null,
        miles_this_month: form.miles_this_month ? parseFloat(form.miles_this_month) : null,
        mpg_display: form.mpg_display ? parseFloat(form.mpg_display) : null,
        gallons: form.gallons ? parseFloat(form.gallons) : null,
        total_cost: form.total_cost ? parseFloat(form.total_cost) : null,
        cost_per_gallon: form.cost_per_gallon ? parseFloat(form.cost_per_gallon) : null,
        fuel_grade: form.fuel_grade || null,
        station: form.station || null,
        notes: form.notes || null,
        source: editingId ? undefined : 'manual',
        finance_category_id: form.finance_category_id || null,
      };
      const res = await fetch('/api/travel/fuel', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowForm(false);
        setForm(BLANK_FORM);
        setOcrNotes('');
        setEditingId(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fuel log?')) return;
    const res = await fetch('/api/travel/fuel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.hasLinkedTransaction) setLinkedTxDialog({ transactionId: d.transactionId });
    }
    load();
  };

  const handleLinkedTxYes = async () => {
    if (!linkedTxDialog) return;
    await fetch('/api/finance/transactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: linkedTxDialog.transactionId }),
    });
    setLinkedTxDialog(null);
  };

  // Build chart data from logs (sorted ascending)
  const chartData = [...logs]
    .filter((l) => l.mpg_display || l.mpg_calculated)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({
      date: l.date.substring(5),
      mpg: l.mpg_display ?? l.mpg_calculated,
      cpg: l.cost_per_gallon,
    }));

  const monthlySpend: Record<string, number> = {};
  for (const l of logs) {
    if (!l.total_cost) continue;
    const m = l.date.substring(0, 7);
    monthlySpend[m] = (monthlySpend[m] || 0) + l.total_cost;
  }
  const spendData = Object.entries(monthlySpend)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total_cost]) => ({ month: month.substring(5), total_cost }));

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/travel" className="text-gray-400 hover:text-gray-600 transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fuel Log</h1>
            <p className="text-sm text-gray-500">{total} fill-ups tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition cursor-pointer">
            {ocrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {ocrLoading ? 'Reading…' : 'Scan Photos'}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files && handleOcr(e.target.files)}
            />
          </label>
          <button
            onClick={() => { setForm(BLANK_FORM); setOcrNotes(''); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">MPG Over Time</h2>
            <div className="h-45">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={(v: any) => [`${fmt(Number(v), 1)} MPG`]} />
                  <Line type="monotone" dataKey="mpg" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {spendData.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Fuel Spend</h2>
              <div className="h-45">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip formatter={(v: any) => [fmtMoney(Number(v))]} />
                    <Bar dataKey="total_cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fuel Log Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Fill-Up History</h2>
        </div>
        {logs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-400 text-sm">No fuel logs yet.</p>
            <p className="text-gray-400 text-xs mt-1">Upload dashboard photos or add manually.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">ODO</th>
                  <th className="px-4 py-3 text-right">Trip A</th>
                  <th className="px-4 py-3 text-right">Trip B (month)</th>
                  <th className="px-4 py-3 text-right">MPG</th>
                  <th className="px-4 py-3 text-right">Gallons</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">$/gal</th>
                  <th className="px-4 py-3 text-left">Station</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{log.date}</td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {log.odometer_miles ? log.odometer_miles.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(log.miles_since_last_fill)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(log.miles_this_month)}</td>
                    <td className="px-4 py-3 text-right font-medium text-blue-700">
                      {fmt(log.mpg_display ?? log.mpg_calculated, 1)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(log.gallons, 3)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(log.total_cost)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(log.cost_per_gallon, 3)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {log.station ?? '—'}
                      {log.source === 'image_ocr' && (
                        <span className="ml-1 text-purple-500 font-medium" title="OCR scan">
                          <Camera className="w-3 h-3 inline" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(log)}
                        className="text-xs text-sky-500 hover:text-sky-700 transition mr-2"
                      >
                        edit
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition"
                      >
                        del
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Linked transaction confirmation dialog */}
      {linkedTxDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h2 className="text-base font-bold text-gray-900">Delete linked transaction?</h2>
            <p className="text-sm text-gray-600">
              This fuel log had a linked finance expense. Do you also want to delete it?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setLinkedTxDialog(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Keep transaction
              </button>
              <button
                onClick={handleLinkedTxYes}
                className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-700 transition"
              >
                Delete it too
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Fuel Entry' : 'Add Fuel Entry'}</h2>

            {ocrNotes && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-xs text-purple-800 flex items-start gap-2">
                <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
                <span><strong>OCR:</strong> {ocrNotes}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input
                  type="date" value={form.date} required
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {vehicles.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                  <select
                    value={form.vehicle_id}
                    onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select vehicle</option>
                    {vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Odometer</label>
                <input type="number" step="0.1" value={form.odometer_miles} placeholder="98832"
                  onChange={(e) => setForm((f) => ({ ...f, odometer_miles: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trip A (since fill)</label>
                <input type="number" step="0.1" value={form.miles_since_last_fill} placeholder="270.8"
                  onChange={(e) => setForm((f) => ({ ...f, miles_since_last_fill: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trip B (this month)</label>
                <input type="number" step="0.1" value={form.miles_this_month} placeholder="270.8"
                  onChange={(e) => setForm((f) => ({ ...f, miles_this_month: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">MPG (display)</label>
                <input type="number" step="0.1" value={form.mpg_display} placeholder="29.8"
                  onChange={(e) => setForm((f) => ({ ...f, mpg_display: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fuel Grade</label>
                <select value={form.fuel_grade}
                  onChange={(e) => setForm((f) => ({ ...f, fuel_grade: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {['regular','midgrade','premium','diesel','e85'].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gallons</label>
                <input type="number" step="0.001" value={form.gallons} placeholder="9.352"
                  onChange={(e) => setForm((f) => ({ ...f, gallons: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total Cost ($)</label>
                <input type="number" step="0.01" value={form.total_cost} placeholder="21.50"
                  onChange={(e) => setForm((f) => ({ ...f, total_cost: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">$/gal</label>
                <input type="number" step="0.001" value={form.cost_per_gallon} placeholder="2.299"
                  onChange={(e) => setForm((f) => ({ ...f, cost_per_gallon: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Station</label>
              <ContactAutocomplete
                value={form.station}
                contactType="vendor"
                placeholder="Costco"
                onChange={(name) => setForm((f) => ({ ...f, station: name }))}
                inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {financeCategories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Finance Category</label>
                <select
                  value={form.finance_category_id}
                  onChange={(e) => setForm((f) => ({ ...f, finance_category_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Uncategorized</option>
                  {financeCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setOcrNotes(''); setEditingId(null); }}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-sky-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
