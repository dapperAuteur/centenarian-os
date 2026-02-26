'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus } from 'lucide-react';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';

interface Trip {
  id: string;
  mode: string;
  date: string;
  origin: string | null;
  destination: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  purpose: string | null;
  calories_burned: number | null;
  co2_kg: number | null;
  cost: number | null;
  transaction_id: string | null;
  source: string;
  notes: string | null;
  tax_category: string | null;
  trip_category: string | null;
  vehicles?: { id: string; nickname: string } | null;
}

interface Vehicle {
  id: string;
  nickname: string;
  type: string;
  active: boolean;
  ownership_type: string;
}

const MODE_ICONS: Record<string, string> = {
  bike: '🚲', car: '🚗', bus: '🚌', train: '🚂', plane: '✈️',
  walk: '🚶', run: '🏃', ferry: '⛴️', rideshare: '🚕', other: '🚐',
};

const HUMAN_POWERED_MODES = ['bike', 'walk', 'run', 'other'];

const BLANK_FORM = {
  mode: 'bike',
  date: new Date().toISOString().split('T')[0],
  origin: '',
  destination: '',
  distance_miles: '',
  duration_min: '',
  purpose: 'commute',
  calories_burned: '',
  notes: '',
  cost: '',
  vehicle_id: '',
  tax_category: 'personal',
  trip_category: 'travel',
};

function fmt(n: number | null | undefined, d = 1) {
  if (n == null) return null;
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState('');
  const [taxFilter, setTaxFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkedTxDialog, setLinkedTxDialog] = useState<{ transactionId: string } | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (modeFilter) params.set('mode', modeFilter);
      if (taxFilter) params.set('tax_category', taxFilter);
      if (categoryFilter) params.set('trip_category', categoryFilter);
      const [tripsRes, vehiclesRes] = await Promise.all([
        fetch(`/api/travel/trips?${params}`),
        fetch('/api/travel/vehicles'), // active only
      ]);
      if (tripsRes.ok) {
        const d = await tripsRes.json();
        setTrips(d.trips || []);
        setTotal(d.total || 0);
      }
      if (vehiclesRes.ok) {
        const d = await vehiclesRes.json();
        setVehicles(d.vehicles || []);
      }
    } finally {
      setLoading(false);
    }
  }, [page, modeFilter, taxFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this trip?')) return;
    const res = await fetch('/api/travel/trips', {
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

  const handleEdit = (t: Trip) => {
    setEditingId(t.id);
    setForm({
      mode: t.mode,
      date: t.date,
      origin: t.origin ?? '',
      destination: t.destination ?? '',
      distance_miles: t.distance_miles != null ? String(t.distance_miles) : '',
      duration_min: t.duration_min != null ? String(t.duration_min) : '',
      purpose: t.purpose ?? 'commute',
      calories_burned: t.calories_burned != null ? String(t.calories_burned) : '',
      cost: t.cost != null ? String(t.cost) : '',
      notes: t.notes ?? '',
      vehicle_id: t.vehicles?.id ?? '',
      tax_category: t.tax_category ?? 'personal',
      trip_category: t.trip_category ?? 'travel',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        mode: form.mode,
        date: form.date,
        origin: form.origin || null,
        destination: form.destination || null,
        distance_miles: form.distance_miles ? parseFloat(form.distance_miles) : null,
        duration_min: form.duration_min ? parseInt(form.duration_min) : null,
        purpose: form.purpose || null,
        calories_burned: form.calories_burned ? parseInt(form.calories_burned) : null,
        cost: form.cost ? parseFloat(form.cost) : null,
        notes: form.notes || null,
        vehicle_id: form.vehicle_id || null,
        tax_category: form.tax_category || 'personal',
        trip_category: form.trip_category || 'travel',
      };
      const res = await fetch('/api/travel/trips', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowForm(false);
        setForm(BLANK_FORM);
        setEditingId(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => { setModeFilter(''); setTaxFilter(''); setCategoryFilter(''); setPage(0); };
  const hasFilter = modeFilter || taxFilter || categoryFilter;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/travel" className="text-gray-400 hover:text-gray-600 transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Trip History</h1>
            <p className="text-sm text-gray-500">{total.toLocaleString()} trips</p>
          </div>
        </div>
        <button
          onClick={() => { setForm(BLANK_FORM); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Trip
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Mode filters */}
        <div className="flex flex-wrap gap-2">
          {['', 'bike', 'car', 'walk', 'run', 'bus', 'train', 'plane'].map((m) => (
            <button
              key={m}
              onClick={() => { setModeFilter(m); setPage(0); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                modeFilter === m && !taxFilter && !categoryFilter
                  ? 'bg-sky-600 text-white'
                  : modeFilter === m
                    ? 'bg-sky-100 text-sky-700 border border-sky-300'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m ? `${MODE_ICONS[m] ?? ''} ${m}` : 'All'}
            </button>
          ))}
        </div>
        {/* Tax and category filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setTaxFilter(taxFilter === 'business' ? '' : 'business'); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              taxFilter === 'business'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Business
          </button>
          <button
            onClick={() => { setTaxFilter(taxFilter === 'medical' ? '' : 'medical'); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              taxFilter === 'medical'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Medical
          </button>
          <button
            onClick={() => { setCategoryFilter(categoryFilter === 'fitness' ? '' : 'fitness'); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              categoryFilter === 'fitness'
                ? 'bg-orange-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Fitness only
          </button>
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-gray-600 transition"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-4 border-sky-600 border-t-transparent rounded-full" />
          </div>
        ) : trips.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">No trips found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-right">Miles</th>
                  <th className="px-4 py-3 text-right">Min</th>
                  <th className="px-4 py-3 text-right">Cal</th>
                  <th className="px-4 py-3 text-left">Tags</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trips.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-base">{MODE_ICONS[t.mode] ?? '🚐'}</span>{' '}
                      <span className="text-gray-700 capitalize">{t.mode}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-50 truncate">
                      {t.origin && t.destination
                        ? `${t.origin} → ${t.destination}`
                        : t.notes?.substring(0, 40) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(t.distance_miles) ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{t.duration_min ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{t.calories_burned ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.tax_category && t.tax_category !== 'personal' && (
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded capitalize font-medium">
                            {t.tax_category}
                          </span>
                        )}
                        {t.trip_category === 'fitness' && (
                          <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                            Fitness
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {t.source === 'garmin_import' ? 'Garmin' : t.source === 'csv_import' ? 'CSV' : 'Manual'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-xs text-sky-500 hover:text-sky-700 transition mr-2"
                      >
                        edit
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >
            Next
          </button>
        </div>
      )}

      {/* Linked transaction confirmation dialog */}
      {linkedTxDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h2 className="text-base font-bold text-gray-900">Delete linked transaction?</h2>
            <p className="text-sm text-gray-600">
              This trip had a linked finance expense. Do you also want to delete it?
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

      {/* Add / Edit Trip Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Trip' : 'Log Trip'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
                <select
                  value={form.mode}
                  onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {['bike','car','bus','train','plane','walk','run','ferry','rideshare','other'].map((m) => (
                    <option key={m} value={m}>{MODE_ICONS[m]} {m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date" value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <ContactAutocomplete
                  value={form.origin}
                  contactType="location"
                  placeholder="Origin"
                  onChange={(name) => setForm((f) => ({ ...f, origin: name }))}
                  inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <ContactAutocomplete
                  value={form.destination}
                  contactType="location"
                  placeholder="Destination"
                  onChange={(name) => setForm((f) => ({ ...f, destination: name }))}
                  inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Miles</label>
                <input
                  type="number" step="0.01" value={form.distance_miles} placeholder="0.0"
                  onChange={(e) => setForm((f) => ({ ...f, distance_miles: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                <input
                  type="number" value={form.duration_min} placeholder="0"
                  onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Calories</label>
                <input
                  type="number" value={form.calories_burned} placeholder="0"
                  onChange={(e) => setForm((f) => ({ ...f, calories_burned: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cost ($)</label>
              <input
                type="number" step="0.01" value={form.cost} placeholder="0.00"
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Purpose</label>
                <select
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {['commute','leisure','work','errand','exercise','other'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tax purpose</label>
                <select
                  value={form.tax_category}
                  onChange={(e) => setForm((f) => ({ ...f, tax_category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="personal">Personal</option>
                  <option value="business">Business</option>
                  <option value="medical">Medical</option>
                  <option value="charitable">Charitable</option>
                </select>
              </div>
            </div>
            {/* Travel vs Fitness toggle — only for human-powered modes */}
            {HUMAN_POWERED_MODES.includes(form.mode) && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trip type</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, trip_category: 'travel' }))}
                    className={`flex-1 py-2 font-medium transition ${form.trip_category === 'travel' ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Travel
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, trip_category: 'fitness' }))}
                    className={`flex-1 py-2 font-medium transition ${form.trip_category === 'fitness' ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Fitness
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Travel counts toward commute savings. Fitness is for workouts.</p>
              </div>
            )}
            {vehicles.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                <select
                  value={form.vehicle_id}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nickname}{v.ownership_type !== 'owned' ? ` (${v.ownership_type})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                type="text" value={form.notes} placeholder="Optional notes"
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setForm(BLANK_FORM); }}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-sky-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Update Trip' : 'Save Trip'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
