'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Download, FileText, ChevronDown, ChevronUp,
  ArrowUpDown, ArrowUp, ArrowDown, X, Search, SlidersHorizontal,
} from 'lucide-react';
import PaginationBar from '@/components/ui/PaginationBar';
import { offlineFetch } from '@/lib/offline/offline-fetch';

/* ─── types ──────────────────────────────────────────────────────────────── */

interface Trip {
  id: string;
  date: string;
  end_date: string | null;
  mode: string;
  origin: string | null;
  destination: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  purpose: string | null;
  cost: number | null;
  budget_amount: number | null;
  trip_category: string | null;
  tax_category: string | null;
  trip_status: string;
  is_round_trip: boolean;
  co2_kg: number | null;
  calories_burned: number | null;
  departed_at: string | null;
  arrived_at: string | null;
  confirmation_number: string | null;
  booking_reference: string | null;
  carrier_name: string | null;
  seat_assignment: string | null;
  terminal: string | null;
  gate: string | null;
  booking_url: string | null;
  accommodation_name: string | null;
  accommodation_address: string | null;
  room_type: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  pickup_address: string | null;
  pickup_time: string | null;
  return_address: string | null;
  return_time: string | null;
  loyalty_program: string | null;
  loyalty_number: string | null;
  notes: string | null;
  vehicles?: { id: string; nickname: string; type: string } | null;
}

/* ─── column definitions ─────────────────────────────────────────────────── */

interface ColDef {
  key: string;
  label: string;
  group: string;
  accessor: (t: Trip) => string;
  sortable?: boolean;
}

const COLUMNS: ColDef[] = [
  // Core
  { key: 'date', label: 'Date', group: 'Core', accessor: (t) => t.date || '', sortable: true },
  { key: 'end_date', label: 'End Date', group: 'Core', accessor: (t) => t.end_date || '' },
  { key: 'mode', label: 'Mode', group: 'Core', accessor: (t) => t.mode || '', sortable: true },
  { key: 'vehicle', label: 'Vehicle', group: 'Core', accessor: (t) => t.vehicles?.nickname || '' },
  { key: 'origin', label: 'Origin', group: 'Core', accessor: (t) => t.origin || '', sortable: true },
  { key: 'destination', label: 'Destination', group: 'Core', accessor: (t) => t.destination || '', sortable: true },
  { key: 'trip_status', label: 'Status', group: 'Core', accessor: (t) => (t.trip_status || '').replace(/_/g, ' '), sortable: true },
  // Distance / Time
  { key: 'distance_miles', label: 'Miles', group: 'Distance', accessor: (t) => t.distance_miles != null ? Number(t.distance_miles).toFixed(1) : '', sortable: true },
  { key: 'duration_min', label: 'Duration', group: 'Distance', accessor: (t) => t.duration_min != null ? `${t.duration_min} min` : '', sortable: true },
  { key: 'is_round_trip', label: 'Round Trip', group: 'Distance', accessor: (t) => t.is_round_trip ? 'Yes' : 'No' },
  { key: 'co2_kg', label: 'CO2 (kg)', group: 'Distance', accessor: (t) => t.co2_kg != null ? Number(t.co2_kg).toFixed(1) : '', sortable: true },
  { key: 'calories_burned', label: 'Calories', group: 'Distance', accessor: (t) => t.calories_burned != null ? String(t.calories_burned) : '', sortable: true },
  { key: 'departed_at', label: 'Departed', group: 'Distance', accessor: (t) => t.departed_at ? new Date(t.departed_at).toLocaleString() : '' },
  { key: 'arrived_at', label: 'Arrived', group: 'Distance', accessor: (t) => t.arrived_at ? new Date(t.arrived_at).toLocaleString() : '' },
  // Financial
  { key: 'cost', label: 'Cost', group: 'Financial', accessor: (t) => t.cost != null ? `$${Number(t.cost).toFixed(2)}` : '', sortable: true },
  { key: 'budget_amount', label: 'Budget', group: 'Financial', accessor: (t) => t.budget_amount != null ? `$${Number(t.budget_amount).toFixed(2)}` : '', sortable: true },
  { key: 'purpose', label: 'Purpose', group: 'Financial', accessor: (t) => t.purpose || '', sortable: true },
  { key: 'tax_category', label: 'Tax Category', group: 'Financial', accessor: (t) => t.tax_category || '', sortable: true },
  { key: 'trip_category', label: 'Trip Category', group: 'Financial', accessor: (t) => t.trip_category || '' },
  // Booking
  { key: 'confirmation_number', label: 'Confirmation #', group: 'Booking', accessor: (t) => t.confirmation_number || '' },
  { key: 'booking_reference', label: 'Booking Ref', group: 'Booking', accessor: (t) => t.booking_reference || '' },
  { key: 'carrier_name', label: 'Carrier', group: 'Booking', accessor: (t) => t.carrier_name || '', sortable: true },
  { key: 'seat_assignment', label: 'Seat', group: 'Booking', accessor: (t) => t.seat_assignment || '' },
  { key: 'terminal', label: 'Terminal', group: 'Booking', accessor: (t) => t.terminal || '' },
  { key: 'gate', label: 'Gate', group: 'Booking', accessor: (t) => t.gate || '' },
  { key: 'booking_url', label: 'Booking URL', group: 'Booking', accessor: (t) => t.booking_url || '' },
  // Accommodation
  { key: 'accommodation_name', label: 'Accommodation', group: 'Accommodation', accessor: (t) => t.accommodation_name || '', sortable: true },
  { key: 'accommodation_address', label: 'Accom. Address', group: 'Accommodation', accessor: (t) => t.accommodation_address || '' },
  { key: 'room_type', label: 'Room Type', group: 'Accommodation', accessor: (t) => t.room_type || '' },
  { key: 'check_in_date', label: 'Check-in', group: 'Accommodation', accessor: (t) => t.check_in_date || '' },
  { key: 'check_out_date', label: 'Check-out', group: 'Accommodation', accessor: (t) => t.check_out_date || '' },
  // Pickup / Return
  { key: 'pickup_address', label: 'Pickup', group: 'Pickup/Return', accessor: (t) => t.pickup_address || '' },
  { key: 'pickup_time', label: 'Pickup Time', group: 'Pickup/Return', accessor: (t) => t.pickup_time || '' },
  { key: 'return_address', label: 'Return', group: 'Pickup/Return', accessor: (t) => t.return_address || '' },
  { key: 'return_time', label: 'Return Time', group: 'Pickup/Return', accessor: (t) => t.return_time || '' },
  // Loyalty
  { key: 'loyalty_program', label: 'Loyalty Program', group: 'Loyalty', accessor: (t) => t.loyalty_program || '' },
  { key: 'loyalty_number', label: 'Loyalty #', group: 'Loyalty', accessor: (t) => t.loyalty_number || '' },
  // Other
  { key: 'notes', label: 'Notes', group: 'Other', accessor: (t) => t.notes || '' },
];

const DEFAULT_VISIBLE = new Set([
  'date', 'mode', 'origin', 'destination', 'distance_miles', 'cost', 'trip_status',
]);

const COLUMN_GROUPS = [...new Set(COLUMNS.map((c) => c.group))];

const MODES = ['bike', 'car', 'bus', 'train', 'plane', 'walk', 'run', 'ferry', 'rideshare', 'other'];
const STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'];
const TAX_CATS = ['personal', 'business', 'medical', 'charitable'];
const TRIP_CATS = ['travel', 'fitness'];

const LS_KEY = 'centos-travel-report-cols';

function loadSavedCols(): Set<string> {
  if (typeof window === 'undefined') return DEFAULT_VISIBLE;
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set(DEFAULT_VISIBLE);
}

/* ─── inner component (needs searchParams) ────────────────────────────── */

function TravelReportsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(loadSavedCols);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);

  // Filter state from URL
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const mode = searchParams.get('mode') || '';
  const status = searchParams.get('trip_status') || '';
  const taxCat = searchParams.get('tax_category') || '';
  const tripCat = searchParams.get('trip_category') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'date';
  const sortDir = searchParams.get('sort_dir') || 'desc';
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = 50;

  // Persist column visibility
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    // Reset page when filters change (unless page itself is being set)
    if (!('page' in updates)) params.set('page', '1');
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const clearFilters = () => {
    router.push('/dashboard/travel/reports', { scroll: false });
  };

  const toggleSort = (col: string) => {
    if (sort === col) {
      updateParams({ sort_dir: sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      updateParams({ sort: col, sort_dir: 'asc' });
    }
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (mode) params.set('mode', mode);
    if (status) params.set('trip_status', status);
    if (taxCat) params.set('tax_category', taxCat);
    if (tripCat) params.set('trip_category', tripCat);
    if (search) params.set('search', search);
    params.set('sort', sort);
    params.set('sort_dir', sortDir);
    params.set('limit', String(perPage));
    params.set('offset', String((page - 1) * perPage));

    try {
      const res = await offlineFetch(`/api/travel/trips?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
        setTotal(data.total ?? 0);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [from, to, mode, status, taxCat, tripCat, search, sort, sortDir, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Summary stats
  const totalMiles = trips.reduce((s, t) => s + (Number(t.distance_miles) || 0), 0);
  const totalCost = trips.reduce((s, t) => s + (Number(t.cost) || 0), 0);
  const totalCo2 = trips.reduce((s, t) => s + (Number(t.co2_kg) || 0), 0);
  const totalPages = Math.ceil(total / perPage);

  // Build CSV export URL with current filters
  const exportUrl = (() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (mode) p.set('mode', mode);
    if (status) p.set('trip_status', status);
    if (taxCat) p.set('tax_category', taxCat);
    if (tripCat) p.set('trip_category', tripCat);
    if (search) p.set('search', search);
    p.set('sort', sort);
    p.set('sort_dir', sortDir);
    return `/api/travel/trips/export?${p.toString()}`;
  })();

  // PDF export
  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape' });
    let y = 15;

    doc.setFontSize(16);
    doc.text('Travel Report', 14, y); y += 8;
    doc.setFontSize(9);
    doc.setTextColor(100);
    const filterParts: string[] = [];
    if (from || to) filterParts.push(`Date: ${from || '...'} to ${to || '...'}`);
    if (mode) filterParts.push(`Mode: ${mode}`);
    if (status) filterParts.push(`Status: ${status}`);
    if (taxCat) filterParts.push(`Tax: ${taxCat}`);
    if (tripCat) filterParts.push(`Category: ${tripCat}`);
    if (search) filterParts.push(`Search: ${search}`);
    if (filterParts.length) { doc.text(filterParts.join(' | '), 14, y); y += 5; }
    doc.text(`${total} trips | ${totalMiles.toFixed(1)} mi | $${totalCost.toFixed(2)} | ${totalCo2.toFixed(1)} kg CO2`, 14, y);
    y += 8;

    const visCols = COLUMNS.filter((c) => visibleCols.has(c.key));

    // Table header
    doc.setFontSize(7);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    const colW = Math.min(Math.floor((280 - 14) / visCols.length), 40);
    visCols.forEach((col, i) => {
      doc.text(col.label, 14 + i * colW, y, { maxWidth: colW - 2 });
    });
    y += 5;
    doc.setFont('helvetica', 'normal');

    // Table rows
    for (const trip of trips) {
      if (y > 190) { doc.addPage(); y = 15; }
      visCols.forEach((col, i) => {
        const val = col.accessor(trip);
        doc.text(val.slice(0, 30), 14 + i * colW, y, { maxWidth: colW - 2 });
      });
      y += 4;
    }

    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('Generated by CentenarianOS', 14, 200);
    doc.save('travel-report.pdf');
  };

  const hasActiveFilters = from || to || mode || status || taxCat || tripCat || search;

  const toggleCol = (key: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    const groupKeys = COLUMNS.filter((c) => c.group === group).map((c) => c.key);
    const allVisible = groupKeys.every((k) => visibleCols.has(k));
    setVisibleCols((prev) => {
      const next = new Set(prev);
      for (const k of groupKeys) {
        if (allVisible) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  const visCols = COLUMNS.filter((c) => visibleCols.has(c.key));

  return (
    <div className="max-w-[100vw] px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/travel"
            className="min-h-11 min-w-11 flex items-center justify-center text-gray-500 hover:text-gray-900 transition"
            aria-label="Back to travel dashboard"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Travel Reports</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="min-h-11 flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            aria-expanded={showFilters}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-sky-500" />}
          </button>
          <button
            onClick={() => setShowColumns((v) => !v)}
            className="min-h-11 flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            aria-expanded={showColumns}
            aria-label="Toggle column visibility"
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            Columns
          </button>
          <a
            href={exportUrl}
            className="min-h-11 flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-500 transition"
            aria-label="Export as CSV"
          >
            <Download className="w-4 h-4" aria-hidden="true" /> CSV
          </a>
          <button
            onClick={handleExportPDF}
            className="min-h-11 flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            aria-label="Export as PDF"
          >
            <FileText className="w-4 h-4" aria-hidden="true" /> PDF
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="filter-from" className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input
                id="filter-from"
                type="date"
                value={from}
                onChange={(e) => updateParams({ from: e.target.value })}
                className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="filter-to" className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input
                id="filter-to"
                type="date"
                value={to}
                onChange={(e) => updateParams({ to: e.target.value })}
                className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="filter-mode" className="block text-xs font-medium text-gray-500 mb-1">Mode</label>
              <select
                id="filter-mode"
                value={mode}
                onChange={(e) => updateParams({ mode: e.target.value })}
                className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              >
                <option value="">All</option>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filter-status" className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                id="filter-status"
                value={status}
                onChange={(e) => updateParams({ trip_status: e.target.value })}
                className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              >
                <option value="">All</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filter-tax" className="block text-xs font-medium text-gray-500 mb-1">Tax Category</label>
              <select
                id="filter-tax"
                value={taxCat}
                onChange={(e) => updateParams({ tax_category: e.target.value })}
                className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              >
                <option value="">All</option>
                {TAX_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filter-trip-cat" className="block text-xs font-medium text-gray-500 mb-1">Trip Category</label>
              <select
                id="filter-trip-cat"
                value={tripCat}
                onChange={(e) => updateParams({ trip_category: e.target.value })}
                className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              >
                <option value="">All</option>
                {TRIP_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="filter-search" className="block text-xs font-medium text-gray-500 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <input
                  id="filter-search"
                  type="text"
                  placeholder="Origin, destination, carrier, accommodation..."
                  value={search}
                  onChange={(e) => updateParams({ search: e.target.value })}
                  className="min-h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                />
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 min-h-11 flex items-center gap-1.5 px-3 text-sm text-gray-500 hover:text-gray-900 transition"
              aria-label="Clear all filters"
            >
              <X className="w-4 h-4" aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>
      )}

      {/* Column toggles */}
      {showColumns && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Visible Columns</p>
          {COLUMN_GROUPS.map((group) => {
            const groupCols = COLUMNS.filter((c) => c.group === group);
            const allVisible = groupCols.every((c) => visibleCols.has(c.key));
            return (
              <div key={group} className="mb-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1 cursor-pointer min-h-8">
                  <input
                    type="checkbox"
                    checked={allVisible}
                    onChange={() => toggleGroup(group)}
                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                  />
                  {group}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 ml-5">
                  {groupCols.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer min-h-8">
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.key)}
                        onChange={() => toggleCol(col.key)}
                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-lg font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500">trips</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-lg font-bold text-gray-900">{totalMiles.toFixed(1)}</p>
          <p className="text-xs text-gray-500">miles (page)</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-lg font-bold text-gray-900">${totalCost.toFixed(2)}</p>
          <p className="text-xs text-gray-500">cost (page)</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-lg font-bold text-gray-900">{totalCo2.toFixed(1)}</p>
          <p className="text-xs text-gray-500">kg CO2 (page)</p>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {visCols.map((col, i) => {
                  const isSorted = sort === col.key;
                  const SortIcon = isSorted
                    ? (sortDir === 'asc' ? ArrowUp : ArrowDown)
                    : ArrowUpDown;

                  return (
                    <th
                      key={col.key}
                      className={`text-left text-xs font-semibold text-gray-600 px-3 py-3 whitespace-nowrap ${
                        i === 0 ? 'sticky left-0 z-10 bg-gray-50' : ''
                      }`}
                      aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      {col.sortable ? (
                        <button
                          onClick={() => toggleSort(col.key)}
                          className="min-h-8 flex items-center gap-1 hover:text-gray-900 transition"
                          aria-label={`Sort by ${col.label}`}
                        >
                          {col.label}
                          <SortIcon className={`w-3.5 h-3.5 shrink-0 ${isSorted ? 'text-sky-600' : 'text-gray-400'}`} aria-hidden="true" />
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visCols.length} className="text-center py-12 text-gray-400" aria-label="Loading...">
                    Loading...
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td colSpan={visCols.length} className="text-center py-12 text-gray-400">
                    No trips found.
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr key={trip.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    {visCols.map((col, i) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 whitespace-nowrap text-gray-700 max-w-[200px] truncate ${
                          i === 0 ? 'sticky left-0 z-10 bg-white' : ''
                        }`}
                        title={col.accessor(trip)}
                      >
                        {col.key === 'booking_url' && col.accessor(trip) ? (
                          <a
                            href={col.accessor(trip)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-600 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          col.accessor(trip)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => updateParams({ page: String(p) })}
          variant="light"
        />
      </div>
    </div>
  );
}

/* ─── page wrapper ───────────────────────────────────────────────────────── */

export default function TravelReportsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-sm" role="status" aria-label="Loading...">Loading reports...</p>
      </div>
    }>
      <TravelReportsInner />
    </Suspense>
  );
}
