'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Route } from 'lucide-react';
import ActivityLinker from '@/components/ui/ActivityLinker';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import MultiStopForm from '@/components/travel/MultiStopForm';
import RouteCard from '@/components/travel/RouteCard';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import Modal from '@/components/ui/Modal';

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
  is_round_trip: boolean;
  vehicles?: { id: string; nickname: string } | null;
}

interface Vehicle {
  id: string;
  nickname: string;
  type: string;
  active: boolean;
  ownership_type: string;
  trip_mode: string | null;
}

const MODE_ICONS: Record<string, string> = {
  bike: '🚲', car: '🚗', bus: '🚌', train: '🚂', plane: '✈️',
  walk: '🚶', run: '🏃', ferry: '⛴️', rideshare: '🚕', other: '🚐',
};

const HUMAN_POWERED_MODES = ['bike', 'walk', 'run', 'other'];

const VEHICLE_TYPE_TO_MODE: Record<string, string> = {
  car: 'car', bike: 'bike', ebike: 'bike',
  motorcycle: 'car', scooter: 'car', shoes: 'walk',
};

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
  is_round_trip: false,
};

function fmt(n: number | null | undefined, d = 1) {
  if (n == null) return null;
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function TripsPage() {
  const router = useRouter();
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
  const [showMultiStop, setShowMultiStop] = useState(false);
  const [editingRoute, setEditingRoute] = useState<{
    id: string;
    route: { name: string | null; date: string; notes: string | null; is_round_trip: boolean };
    legs: Array<{ mode: string; origin: string | null; destination: string | null; distance_miles: number | null; duration_min: number | null; cost: number | null; purpose: string | null; vehicle_id: string | null }>;
  } | null>(null);
  const [routes, setRoutes] = useState<Array<{
    id: string; name: string | null; date: string;
    total_distance: number | null; total_duration: number | null;
    total_cost: number | null; total_co2_kg: number | null;
    is_round_trip: boolean; leg_count: number;
  }>>([]);
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
      const [tripsRes, vehiclesRes, routesRes] = await Promise.all([
        offlineFetch(`/api/travel/trips?${params}`),
        offlineFetch('/api/travel/vehicles'), // active only
        page === 0 ? offlineFetch('/api/travel/routes?limit=10') : null,
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
      if (routesRes?.ok) {
        const d = await routesRes.json();
        setRoutes(d.routes || []);
      }
    } finally {
      setLoading(false);
    }
  }, [page, modeFilter, taxFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this trip?')) return;
    const res = await offlineFetch('/api/travel/trips', {
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
    await offlineFetch('/api/finance/transactions', {
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
      is_round_trip: t.is_round_trip ?? false,
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
        is_round_trip: form.is_round_trip,
      };
      const res = await offlineFetch('/api/travel/trips', {
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

  const handleRouteEdit = async (id: string) => {
    const res = await offlineFetch(`/api/travel/routes/${id}`);
    if (!res.ok) return;
    const d = await res.json();
    setEditingRoute({
      id,
      route: { name: d.route.name, date: d.route.date, notes: d.route.notes, is_round_trip: d.route.is_round_trip },
      legs: (d.legs || []).map((l: Record<string, unknown>) => ({
        mode: l.mode, origin: l.origin, destination: l.destination,
        distance_miles: l.distance_miles, duration_min: l.duration_min,
        cost: l.cost, purpose: l.purpose, vehicle_id: l.vehicle_id,
      })),
    });
  };

  const handleRouteDuplicate = async (id: string) => {
    const res = await offlineFetch(`/api/travel/routes/${id}/duplicate`, { method: 'POST' });
    if (res.ok) load();
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMultiStop(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-sky-600 text-sky-600 rounded-xl text-sm font-medium hover:bg-sky-50 transition"
          >
            <Route className="w-4 h-4" />
            Multi-Stop
          </button>
          <button
            onClick={() => { setForm(BLANK_FORM); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Trip
          </button>
        </div>
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

      {/* Routes */}
      {routes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500">Recent Routes</h2>
          {routes.map((r) => (
            <RouteCard
              key={r.id}
              route={r}
              onEdit={handleRouteEdit}
              onDuplicate={handleRouteDuplicate}
              onDelete={async (id) => {
                if (!confirm('Delete this route and all its trips?')) return;
                const res = await offlineFetch(`/api/travel/routes/${id}`, { method: 'DELETE' });
                if (res.ok) load();
              }}
              onExpand={async (id) => {
                const res = await offlineFetch(`/api/travel/routes/${id}`);
                if (res.ok) {
                  const d = await res.json();
                  return d.legs || [];
                }
                return [];
              }}
            />
          ))}
        </div>
      )}

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
                  <tr key={t.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => router.push(`/dashboard/travel/trips/${t.id}`)}>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-base">{MODE_ICONS[t.mode] ?? '🚐'}</span>{' '}
                      <span className="text-gray-700 capitalize">{t.mode}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-50 truncate">
                      {t.origin && t.destination
                        ? `${t.origin} ${t.is_round_trip ? '↔' : '→'} ${t.destination}`
                        : t.notes?.substring(0, 40) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(t.distance_miles) ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{t.duration_min ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{t.calories_burned ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.is_round_trip && (
                          <span className="text-xs bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-medium">
                            RT
                          </span>
                        )}
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
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
      <Modal isOpen={!!linkedTxDialog} onClose={() => setLinkedTxDialog(null)} title="Delete linked transaction?" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            This trip had a linked finance expense. Do you also want to delete it?
          </p>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 pt-3 pb-3 flex gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
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
      </Modal>

      {/* Multi-Stop Form Modal (create) */}
      {showMultiStop && (
        <MultiStopForm
          vehicles={vehicles}
          onClose={() => setShowMultiStop(false)}
          onSaved={load}
        />
      )}

      {/* Multi-Stop Form Modal (edit) */}
      {editingRoute && (
        <MultiStopForm
          vehicles={vehicles}
          editRouteId={editingRoute.id}
          initialRoute={editingRoute.route}
          initialLegs={editingRoute.legs}
          onClose={() => setEditingRoute(null)}
          onSaved={load}
        />
      )}

      {/* Add / Edit Trip Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditingId(null); setForm(BLANK_FORM); }} title={editingId ? 'Edit Trip' : 'Log Trip'} size="sm">
        <form onSubmit={handleSave}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-mode" className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
                <select
                  id="trip-mode"
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
                <label htmlFor="trip-date" className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  id="trip-date"
                  type="date" value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  required
                  aria-required="true"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-origin" className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <ContactAutocomplete
                  value={form.origin}
                  contactType="location"
                  placeholder="Origin"
                  onChange={(name) => setForm((f) => ({ ...f, origin: name }))}
                  inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  showLocations
                />
              </div>
              <div>
                <label htmlFor="trip-destination" className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <ContactAutocomplete
                  value={form.destination}
                  contactType="location"
                  placeholder="Destination"
                  onChange={(name) => setForm((f) => ({ ...f, destination: name }))}
                  inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  showLocations
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_round_trip}
                onChange={(e) => setForm((f) => ({ ...f, is_round_trip: e.target.checked }))}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-xs font-medium text-gray-600">Round trip (distance counted both ways)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="trip-miles" className="block text-xs font-medium text-gray-600 mb-1">Miles</label>
                <input
                  id="trip-miles"
                  type="number" step="0.01" value={form.distance_miles} placeholder="0.0"
                  onChange={(e) => setForm((f) => ({ ...f, distance_miles: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="trip-duration" className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                <input
                  id="trip-duration"
                  type="number" value={form.duration_min} placeholder="0"
                  onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="trip-calories" className="block text-xs font-medium text-gray-600 mb-1">Calories</label>
                <input
                  id="trip-calories"
                  type="number" value={form.calories_burned} placeholder="0"
                  onChange={(e) => setForm((f) => ({ ...f, calories_burned: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="trip-cost" className="block text-xs font-medium text-gray-600 mb-1">Cost ($)</label>
              <input
                id="trip-cost"
                type="number" step="0.01" value={form.cost} placeholder="0.00"
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-purpose" className="block text-xs font-medium text-gray-600 mb-1">Purpose</label>
                <select
                  id="trip-purpose"
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
                <label htmlFor="trip-tax" className="block text-xs font-medium text-gray-600 mb-1">Tax purpose</label>
                <select
                  id="trip-tax"
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
                <label htmlFor="trip-vehicle" className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                <select
                  id="trip-vehicle"
                  value={form.vehicle_id}
                  onChange={(e) => {
                    const vid = e.target.value;
                    const v = vehicles.find((veh) => veh.id === vid);
                    const autoMode = v ? (v.trip_mode || VEHICLE_TYPE_TO_MODE[v.type]) : undefined;
                    setForm((f) => ({
                      ...f,
                      vehicle_id: vid,
                      ...(autoMode ? { mode: autoMode } : {}),
                    }));
                  }}
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
              <label htmlFor="trip-notes" className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                id="trip-notes"
                type="text" value={form.notes} placeholder="Optional notes"
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            {editingId && (
              <div className="pt-3 border-t border-gray-200">
                <ActivityLinker entityType="trip" entityId={editingId} />
              </div>
            )}
          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 pt-3 pb-3 flex gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); setForm(BLANK_FORM); }}
              className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-sky-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Update Trip' : 'Save Trip'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
