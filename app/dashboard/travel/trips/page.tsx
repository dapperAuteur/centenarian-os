'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, ChevronDown, Search, Trash2, Play, Repeat, MapPin, Pencil } from 'lucide-react';
import PaginationBar from '@/components/ui/PaginationBar';
import ActivityLinker from '@/components/ui/ActivityLinker';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import MultiStopForm from '@/components/travel/MultiStopForm';
import GoogleMapsImportModal from '@/components/travel/GoogleMapsImportModal';
import RouteCard from '@/components/travel/RouteCard';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import Modal from '@/components/ui/Modal';
import EditTemplateModal from '@/components/travel/EditTemplateModal';

interface Trip {
  id: string;
  mode: string;
  date: string;
  end_date: string | null;
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
  trip_status: string;
  packing_notes: string | null;
  is_round_trip: boolean;
  confirmation_number: string | null;
  booking_reference: string | null;
  carrier_name: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  pickup_address: string | null;
  return_address: string | null;
  pickup_time: string | null;
  return_time: string | null;
  seat_assignment: string | null;
  terminal: string | null;
  gate: string | null;
  booking_url: string | null;
  accommodation_name: string | null;
  accommodation_address: string | null;
  room_type: string | null;
  loyalty_program: string | null;
  loyalty_number: string | null;
  budget_amount: number | null;
  brand_id: string | null;
  visibility: string;
  fifo_cost: number | null;
  cost_source: string;
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

interface TripTemplate {
  id: string;
  name: string;
  mode: string;
  vehicle_id: string | null;
  origin: string | null;
  destination: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  cost: number | null;
  purpose: string | null;
  trip_category: string | null;
  tax_category: string | null;
  notes: string | null;
  is_round_trip: boolean;
  is_multi_stop: boolean;
  brand_id: string | null;
  use_count: number;
  stops?: Array<{
    stop_order: number;
    location_name: string;
    mode: string | null;
    vehicle_id: string | null;
    distance_miles: number | null;
    duration_min: number | null;
    cost: number | null;
    purpose: string | null;
  }>;
}

const MODE_ICONS: Record<string, string> = {
  bike: '🚲', car: '🚗', bus: '🚌', train: '🚂', plane: '✈️',
  walk: '🚶', run: '🏃', ferry: '⛴️', rideshare: '🚕', other: '🚐',
};

const HUMAN_POWERED_MODES = ['bike', 'walk', 'run', 'other'];

const VEHICLE_TYPE_TO_MODE: Record<string, string> = {
  car: 'car', bike: 'bike', ebike: 'bike',
  motorcycle: 'car', scooter: 'car', shoes: 'walk',
  plane: 'plane', train: 'train', bus: 'bus',
  ferry: 'ferry', rideshare: 'rideshare',
};

const BLANK_FORM = {
  mode: 'bike',
  date: new Date().toISOString().split('T')[0],
  end_date: '',
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
  trip_status: 'completed',
  packing_notes: '',
  is_round_trip: false,
  confirmation_number: '',
  booking_reference: '',
  carrier_name: '',
  check_in_date: '',
  check_out_date: '',
  pickup_address: '',
  return_address: '',
  pickup_time: '',
  return_time: '',
  seat_assignment: '',
  terminal: '',
  gate: '',
  booking_url: '',
  accommodation_name: '',
  accommodation_address: '',
  room_type: '',
  loyalty_program: '',
  loyalty_number: '',
  budget_amount: '',
  brand_id: '',
  visibility: 'private',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  planned: { label: 'Planned', className: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'In Progress', className: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
};

function fmt(n: number | null | undefined, d = 1) {
  if (n == null) return null;
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function TripsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [modeFilter, setModeFilter] = useState(() => searchParams.get('mode') || '');
  const [taxFilter, setTaxFilter] = useState(() => searchParams.get('tax_category') || '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('trip_category') || '');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('trip_status') || '');
  const [fromDate, setFromDate] = useState(() => searchParams.get('from') || '');
  const [toDate, setToDate] = useState(() => searchParams.get('to') || '');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkedTxDialog, setLinkedTxDialog] = useState<{ transactionId: string } | null>(null);
  const [showMultiStop, setShowMultiStop] = useState(false);
  const [showMapsImport, setShowMapsImport] = useState(false);
  const [importedRoute, setImportedRoute] = useState<{
    name: string | null;
    isRoundTrip: boolean;
    legs: Array<{ mode: string; origin: string | null; destination: string | null; distance_miles: number | null; duration_min: number | null; cost: number | null; purpose: string | null; vehicle_id: string | null }>;
  } | null>(null);
  const [showBookingDetails, setShowBookingDetails] = useState(false);
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
  const [templates, setTemplates] = useState<TripTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TripTemplate | null>(null);
  const [fifoEstimate, setFifoEstimate] = useState<{ estimatedCost: number; mpgUsed: number; isPartial: boolean } | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (search) params.set('search', search);
      if (modeFilter) params.set('mode', modeFilter);
      if (taxFilter) params.set('tax_category', taxFilter);
      if (categoryFilter) params.set('trip_category', categoryFilter);
      if (statusFilter) params.set('trip_status', statusFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const [tripsRes, vehiclesRes, routesRes, brandsRes, templatesRes] = await Promise.all([
        offlineFetch(`/api/travel/trips?${params}`),
        offlineFetch('/api/travel/vehicles'), // active only
        page === 0 ? offlineFetch('/api/travel/routes?limit=10') : null,
        offlineFetch('/api/brands'),
        offlineFetch('/api/travel/templates'),
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
      if (brandsRes.ok) {
        const d = await brandsRes.json();
        setBrands(d || []);
      }
      if (templatesRes.ok) {
        const d = await templatesRes.json();
        setTemplates(d || []);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, modeFilter, taxFilter, categoryFilter, statusFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  // Fetch FIFO estimate when form fields change (debounced)
  useEffect(() => {
    if (!showForm) { setFifoEstimate(null); return; }
    const isFuelMode = form.mode === 'car' || form.mode === 'motorcycle';
    if (!isFuelMode || !form.vehicle_id || !form.distance_miles || !form.date) {
      setFifoEstimate(null);
      return;
    }
    // Don't show estimate if user typed a manual cost
    if (form.cost) { setFifoEstimate(null); return; }

    const timer = setTimeout(async () => {
      try {
        const res = await offlineFetch('/api/travel/fifo/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicle_id: form.vehicle_id,
            distance_miles: parseFloat(form.distance_miles),
            is_round_trip: form.is_round_trip,
            trip_date: form.date,
          }),
        });
        if (res.ok) {
          const d = await res.json();
          setFifoEstimate(d.estimate);
        }
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [showForm, form.mode, form.vehicle_id, form.distance_miles, form.date, form.is_round_trip, form.cost]);

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
      end_date: t.end_date ?? '',
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
      trip_status: t.trip_status ?? 'completed',
      packing_notes: t.packing_notes ?? '',
      is_round_trip: t.is_round_trip ?? false,
      confirmation_number: t.confirmation_number ?? '',
      booking_reference: t.booking_reference ?? '',
      carrier_name: t.carrier_name ?? '',
      check_in_date: t.check_in_date ?? '',
      check_out_date: t.check_out_date ?? '',
      pickup_address: t.pickup_address ?? '',
      return_address: t.return_address ?? '',
      pickup_time: t.pickup_time ?? '',
      return_time: t.return_time ?? '',
      seat_assignment: t.seat_assignment ?? '',
      terminal: t.terminal ?? '',
      gate: t.gate ?? '',
      booking_url: t.booking_url ?? '',
      accommodation_name: t.accommodation_name ?? '',
      accommodation_address: t.accommodation_address ?? '',
      room_type: t.room_type ?? '',
      loyalty_program: t.loyalty_program ?? '',
      loyalty_number: t.loyalty_number ?? '',
      budget_amount: t.budget_amount != null ? String(t.budget_amount) : '',
      brand_id: t.brand_id ?? '',
      visibility: t.visibility ?? 'private',
    });
    setShowBookingDetails(!!(t.confirmation_number || t.carrier_name || t.accommodation_name || t.seat_assignment || t.booking_url));
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
        trip_status: form.trip_status || 'completed',
        end_date: form.end_date || null,
        packing_notes: form.packing_notes || null,
        is_round_trip: form.is_round_trip,
        // Booking details
        confirmation_number: form.confirmation_number || null,
        booking_reference: form.booking_reference || null,
        carrier_name: form.carrier_name || null,
        check_in_date: form.check_in_date || null,
        check_out_date: form.check_out_date || null,
        pickup_address: form.pickup_address || null,
        return_address: form.return_address || null,
        pickup_time: form.pickup_time || null,
        return_time: form.return_time || null,
        seat_assignment: form.seat_assignment || null,
        terminal: form.terminal || null,
        gate: form.gate || null,
        booking_url: form.booking_url || null,
        accommodation_name: form.accommodation_name || null,
        accommodation_address: form.accommodation_address || null,
        room_type: form.room_type || null,
        loyalty_program: form.loyalty_program || null,
        loyalty_number: form.loyalty_number || null,
        // Budget & sharing
        budget_amount: form.budget_amount ? parseFloat(form.budget_amount) : null,
        brand_id: form.brand_id || null,
        visibility: form.visibility || 'private',
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

  const handleTemplateLog = async (tmpl: TripTemplate) => {
    const res = await offlineFetch('/api/travel/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        create_trip: true,
        template_id: tmpl.id,
        trip_date: new Date().toISOString().split('T')[0],
      }),
    });
    if (res.ok) load();
  };

  const handleTemplateDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    const res = await offlineFetch(`/api/travel/templates/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  const clearFilters = () => { setSearch(''); setModeFilter(''); setTaxFilter(''); setCategoryFilter(''); setStatusFilter(''); setFromDate(''); setToDate(''); setPage(0); };
  const hasFilter = search || modeFilter || taxFilter || categoryFilter || statusFilter || fromDate || toDate;
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
            onClick={() => setShowMapsImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-sky-200 text-sky-700 rounded-xl text-sm font-medium hover:bg-sky-50 transition min-h-11"
          >
            <MapPin className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Maps Import</span>
          </button>
          <button
            onClick={() => setShowMultiStop(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700 transition min-h-11"
          >
            <Plus className="w-4 h-4" />
            Add Trip
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Search + date range */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search origin, destination, notes…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
          <input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <input
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(0); }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>
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
          <span className="text-gray-300">|</span>
          <button
            onClick={() => { setStatusFilter(statusFilter === 'planned' ? '' : 'planned'); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              statusFilter === 'planned'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Planned
          </button>
          <button
            onClick={() => { setStatusFilter(statusFilter === 'in_progress' ? '' : 'in_progress'); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              statusFilter === 'in_progress'
                ? 'bg-amber-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            In Progress
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

      {/* Templates */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition min-h-11"
          >
            <Repeat className="w-4 h-4" />
            My Templates ({templates.length})
            <ChevronDown className={`w-4 h-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>
          {showTemplates && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templates.map((tmpl) => (
                <div key={tmpl.id} className="border border-gray-200 rounded-xl bg-white p-3 flex items-center gap-3">
                  <span className="text-lg shrink-0">{MODE_ICONS[tmpl.mode] ?? '🚐'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900 truncate">{tmpl.name}</span>
                      {tmpl.is_round_trip && (
                        <span className="text-xs bg-sky-50 text-sky-600 px-1 py-0.5 rounded font-medium shrink-0">RT</span>
                      )}
                      {tmpl.is_multi_stop && (
                        <span className="text-xs bg-fuchsia-50 text-fuchsia-600 px-1 py-0.5 rounded font-medium shrink-0">Multi</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {tmpl.is_multi_stop
                        ? `${tmpl.stops?.length ?? 0} stops`
                        : tmpl.origin && tmpl.destination
                          ? `${tmpl.origin} → ${tmpl.destination}`
                          : tmpl.mode
                      }
                      {tmpl.distance_miles != null && !tmpl.is_multi_stop && (
                        <> · {tmpl.is_round_trip ? (tmpl.distance_miles * 2).toFixed(1) : tmpl.distance_miles.toFixed(1)} mi</>
                      )}
                      {tmpl.use_count > 0 && <> · used {tmpl.use_count}×</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTemplateLog(tmpl)}
                      className="min-h-11 min-w-11 flex items-center justify-center text-sky-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition"
                      aria-label={`Log trip from ${tmpl.name}`}
                      title="Quick log"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTemplate(tmpl)}
                      className="min-h-11 min-w-11 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                      aria-label={`Edit template ${tmpl.name}`}
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTemplateDelete(tmpl.id)}
                      className="min-h-11 min-w-11 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      aria-label={`Delete template ${tmpl.name}`}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    <td className="px-4 py-3 text-right text-gray-700">{t.distance_miles != null ? fmt(t.is_round_trip ? t.distance_miles * 2 : t.distance_miles) : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{t.duration_min != null ? (t.is_round_trip ? t.duration_min * 2 : t.duration_min) : '—'}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{t.calories_burned ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.trip_status && t.trip_status !== 'completed' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[t.trip_status]?.className ?? 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_BADGE[t.trip_status]?.label ?? t.trip_status}
                          </span>
                        )}
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
                        {t.cost_source === 'fifo' && (
                          <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-medium" title={`FIFO fuel cost: $${Number(t.fifo_cost).toFixed(2)}`}>
                            FIFO
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

      <PaginationBar page={page + 1} totalPages={totalPages} onPageChange={(p) => setPage(p - 1)} variant="light" />

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

      {/* Google Maps Import Modal */}
      <GoogleMapsImportModal
        isOpen={showMapsImport}
        onClose={() => setShowMapsImport(false)}
        onImported={(route) => {
          setImportedRoute(route);
          setShowMapsImport(false);
        }}
      />

      {/* Multi-Stop Form from Maps Import */}
      {importedRoute && (
        <MultiStopForm
          vehicles={vehicles}
          brands={brands}
          templates={templates}
          initialRoute={{
            name: importedRoute.name,
            date: new Date().toISOString().split('T')[0],
            notes: null,
            is_round_trip: importedRoute.isRoundTrip,
          }}
          initialLegs={importedRoute.legs}
          onClose={() => setImportedRoute(null)}
          onSaved={() => { setImportedRoute(null); load(); }}
        />
      )}

      {/* Unified Trip / Multi-Stop Form Modal (create) */}
      {showMultiStop && (
        <MultiStopForm
          vehicles={vehicles}
          brands={brands}
          templates={templates}
          onClose={() => setShowMultiStop(false)}
          onSaved={load}
        />
      )}

      {/* Unified Trip / Multi-Stop Form Modal (edit) */}
      {editingRoute && (
        <MultiStopForm
          vehicles={vehicles}
          brands={brands}
          templates={templates}
          editRouteId={editingRoute.id}
          initialRoute={editingRoute.route}
          initialLegs={editingRoute.legs}
          onClose={() => setEditingRoute(null)}
          onSaved={load}
        />
      )}

      {/* Add / Edit Trip Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditingId(null); setForm(BLANK_FORM); }} title={editingId ? 'Edit Trip' : form.trip_status === 'planned' ? 'Plan Trip' : 'Log Trip'} size="sm">
        <form onSubmit={handleSave}>
          <div className="p-6 space-y-4">
            {/* Status selector */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {(['planned', 'in_progress', 'completed'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, trip_status: s }))}
                    className={`flex-1 py-2 font-medium transition capitalize ${form.trip_status === s
                      ? s === 'planned' ? 'bg-blue-600 text-white'
                        : s === 'in_progress' ? 'bg-amber-500 text-white'
                        : 'bg-green-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
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
                <label htmlFor="trip-date" className="block text-xs font-medium text-gray-600 mb-1">{form.trip_status === 'planned' ? 'Start Date' : 'Date'}</label>
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
            {/* End date for multi-day trips */}
            {(form.trip_status === 'planned' || form.trip_status === 'in_progress' || form.end_date) && (
              <div>
                <label htmlFor="trip-end-date" className="block text-xs font-medium text-gray-600 mb-1">End Date (optional, for multi-day trips)</label>
                <input
                  id="trip-end-date"
                  type="date" value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  min={form.date}
                />
              </div>
            )}
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
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_round_trip}
                  onChange={(e) => setForm((f) => ({ ...f, is_round_trip: e.target.checked }))}
                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs font-medium text-gray-600">Round trip (distance counted both ways)</span>
              </label>
              {form.is_round_trip && (form.distance_miles || form.duration_min || form.cost) && (
                <p className="text-xs text-sky-600 mt-1 ml-6">
                  Effective total:{' '}
                  {form.distance_miles && <span>{(parseFloat(form.distance_miles) * 2).toFixed(1)} mi</span>}
                  {form.distance_miles && form.duration_min && <span> &middot; </span>}
                  {form.duration_min && <span>{parseInt(form.duration_min) * 2} min</span>}
                  {(form.distance_miles || form.duration_min) && form.cost && <span> &middot; </span>}
                  {form.cost && <span>${(parseFloat(form.cost) * 2).toFixed(2)}</span>}
                </p>
              )}
            </div>
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
                type="number" step="0.01" value={form.cost}
                placeholder={fifoEstimate ? `Auto: $${fifoEstimate.estimatedCost.toFixed(2)}` : '0.00'}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              {fifoEstimate && !form.cost && (
                <p className="text-xs text-sky-600 mt-1">
                  Est. fuel cost: ${fifoEstimate.estimatedCost.toFixed(2)} ({fifoEstimate.mpgUsed.toFixed(1)} MPG)
                  {fifoEstimate.isPartial && <span className="text-amber-600 ml-1">(partial — tank low)</span>}
                </p>
              )}
              {fifoEstimate && form.cost && (
                <p className="text-xs text-gray-400 mt-1">Manual override — FIFO will not be used</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-budget" className="block text-xs font-medium text-gray-600 mb-1">Budget ($)</label>
                <input
                  id="trip-budget"
                  type="number" step="0.01" value={form.budget_amount} placeholder="0.00"
                  onChange={(e) => setForm((f) => ({ ...f, budget_amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {brands.length > 0 && (
                <div>
                  <label htmlFor="trip-brand" className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                  <select
                    id="trip-brand"
                    value={form.brand_id}
                    onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
            {/* Packing notes for planned trips */}
            {(form.trip_status === 'planned' || form.trip_status === 'in_progress' || form.packing_notes) && (
              <div>
                <label htmlFor="trip-packing" className="block text-xs font-medium text-gray-600 mb-1">Packing Notes</label>
                <textarea
                  id="trip-packing"
                  value={form.packing_notes}
                  onChange={(e) => setForm((f) => ({ ...f, packing_notes: e.target.value }))}
                  placeholder="Items to pack, things to remember..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Link equipment below for a packing checklist</p>
              </div>
            )}
            {/* Collapsible Booking Details */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowBookingDetails((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition min-h-11"
              >
                <span>Booking Details</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showBookingDetails ? 'rotate-180' : ''}`} />
              </button>
              {showBookingDetails && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label htmlFor="trip-confirmation" className="block text-xs font-medium text-gray-600 mb-1">Confirmation #</label>
                      <input id="trip-confirmation" type="text" value={form.confirmation_number} placeholder="ABC123"
                        onChange={(e) => setForm((f) => ({ ...f, confirmation_number: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="trip-booking-ref" className="block text-xs font-medium text-gray-600 mb-1">Booking Ref</label>
                      <input id="trip-booking-ref" type="text" value={form.booking_reference} placeholder="Optional"
                        onChange={(e) => setForm((f) => ({ ...f, booking_reference: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="trip-carrier" className="block text-xs font-medium text-gray-600 mb-1">
                      {form.mode === 'plane' ? 'Airline' : form.mode === 'bus' ? 'Bus Company' : form.mode === 'train' ? 'Rail Company' : 'Carrier / Company'}
                    </label>
                    <input id="trip-carrier" type="text" value={form.carrier_name}
                      onChange={(e) => setForm((f) => ({ ...f, carrier_name: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  {/* Flight-specific */}
                  {form.mode === 'plane' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="trip-seat" className="block text-xs font-medium text-gray-600 mb-1">Seat</label>
                        <input id="trip-seat" type="text" value={form.seat_assignment} placeholder="12A"
                          onChange={(e) => setForm((f) => ({ ...f, seat_assignment: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label htmlFor="trip-terminal" className="block text-xs font-medium text-gray-600 mb-1">Terminal</label>
                        <input id="trip-terminal" type="text" value={form.terminal} placeholder="B"
                          onChange={(e) => setForm((f) => ({ ...f, terminal: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label htmlFor="trip-gate" className="block text-xs font-medium text-gray-600 mb-1">Gate</label>
                        <input id="trip-gate" type="text" value={form.gate} placeholder="B22"
                          onChange={(e) => setForm((f) => ({ ...f, gate: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </div>
                  )}
                  {/* Accommodation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="trip-accom-name" className="block text-xs font-medium text-gray-600 mb-1">Hotel / Accommodation</label>
                      <input id="trip-accom-name" type="text" value={form.accommodation_name}
                        onChange={(e) => setForm((f) => ({ ...f, accommodation_name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="trip-room" className="block text-xs font-medium text-gray-600 mb-1">Room Type</label>
                      <input id="trip-room" type="text" value={form.room_type} placeholder="King Suite"
                        onChange={(e) => setForm((f) => ({ ...f, room_type: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="trip-accom-addr" className="block text-xs font-medium text-gray-600 mb-1">Accommodation Address</label>
                    <input id="trip-accom-addr" type="text" value={form.accommodation_address}
                      onChange={(e) => setForm((f) => ({ ...f, accommodation_address: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="trip-checkin" className="block text-xs font-medium text-gray-600 mb-1">Check-in</label>
                      <input id="trip-checkin" type="date" value={form.check_in_date}
                        onChange={(e) => setForm((f) => ({ ...f, check_in_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="trip-checkout" className="block text-xs font-medium text-gray-600 mb-1">Check-out</label>
                      <input id="trip-checkout" type="date" value={form.check_out_date}
                        onChange={(e) => setForm((f) => ({ ...f, check_out_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  {/* Pickup / Return */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="trip-pickup-addr" className="block text-xs font-medium text-gray-600 mb-1">Pickup Address</label>
                      <input id="trip-pickup-addr" type="text" value={form.pickup_address}
                        onChange={(e) => setForm((f) => ({ ...f, pickup_address: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="trip-return-addr" className="block text-xs font-medium text-gray-600 mb-1">Return Address</label>
                      <input id="trip-return-addr" type="text" value={form.return_address}
                        onChange={(e) => setForm((f) => ({ ...f, return_address: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="trip-pickup-time" className="block text-xs font-medium text-gray-600 mb-1">Pickup Time</label>
                      <input id="trip-pickup-time" type="time" value={form.pickup_time}
                        onChange={(e) => setForm((f) => ({ ...f, pickup_time: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="trip-return-time" className="block text-xs font-medium text-gray-600 mb-1">Return Time</label>
                      <input id="trip-return-time" type="time" value={form.return_time}
                        onChange={(e) => setForm((f) => ({ ...f, return_time: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  {/* Loyalty + Booking URL */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="trip-loyalty-prog" className="block text-xs font-medium text-gray-600 mb-1">Loyalty Program</label>
                      <input id="trip-loyalty-prog" type="text" value={form.loyalty_program} placeholder="Delta SkyMiles"
                        onChange={(e) => setForm((f) => ({ ...f, loyalty_program: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="trip-loyalty-num" className="block text-xs font-medium text-gray-600 mb-1">Loyalty / Member #</label>
                      <input id="trip-loyalty-num" type="text" value={form.loyalty_number}
                        onChange={(e) => setForm((f) => ({ ...f, loyalty_number: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="trip-booking-url" className="block text-xs font-medium text-gray-600 mb-1">Booking URL</label>
                    <input id="trip-booking-url" type="url" value={form.booking_url} placeholder="https://..."
                      onChange={(e) => setForm((f) => ({ ...f, booking_url: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              )}
            </div>
            {editingId && (
              <div className="pt-3 border-t border-gray-200">
                <ActivityLinker entityType="trip" entityId={editingId} />
              </div>
            )}
          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 pt-3 pb-3 flex flex-col sm:flex-row gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); setForm(BLANK_FORM); }}
              className="flex-1 border border-gray-200 rounded-xl min-h-11 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className={`flex-1 text-white rounded-xl min-h-11 text-sm font-medium transition disabled:opacity-50 ${form.trip_status === 'planned' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-sky-600 hover:bg-sky-700'}`}>
              {saving ? 'Saving...' : editingId ? 'Update Trip' : form.trip_status === 'planned' ? 'Plan Trip' : 'Save Trip'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Template Modal */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          vehicles={vehicles}
          brands={brands}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => { setEditingTemplate(null); load(); }}
        />
      )}
    </div>
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-8"><p className="text-sm text-gray-400">Loading trips…</p></div>}>
      <TripsPageInner />
    </Suspense>
  );
}
