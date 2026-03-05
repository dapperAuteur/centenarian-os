'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Bike, Car, Flame, Leaf, DollarSign, Gauge,
  Plus, ChevronRight, AlertCircle, Upload, Zap,
  Repeat, Wrench, Play, Download,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import Modal from '@/components/ui/Modal';

interface Summary {
  currentMonth: {
    milesByMode: Record<string, number>;
    calsByMode: Record<string, number>;
    totalCo2EmittedKg: number;
    co2SavedKgVsCar: number;
    fuelSpend: number;
    fuelGallons: number;
    avgMpg: number | null;
    bikeCommuteDays: number;
    bikeMiles: number;
    carMiles: number;
    bikeSavings: number | null;
    carCostPerMile: number | null;
  };
  monthlyTrend: { month: string; miles: number; fuel_cost: number; bike_miles: number; car_miles: number; co2_kg: number }[];
  mpgTrend: { date: string; mpg: number }[];
  maintenanceAlerts: { id: string; service_type: string; vehicle: { nickname: string } | null; next_service_miles: number | null; next_service_date: string | null }[];
}

interface Vehicle {
  id: string;
  type: string;
  nickname: string;
  make: string | null;
  model: string | null;
  year: number | null;
  active: boolean;
  ownership_type: 'owned' | 'rental' | 'borrowed';
  trip_mode: string | null;
  latest_odometer: number | null;
}

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
}

interface TravelSettings {
  commute_distance_miles: number | null;
  commute_duration_min: number | null;
  default_vehicle_id: string | null;
}

interface TripTemplate {
  id: string;
  name: string;
  mode: string;
  origin: string | null;
  destination: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  use_count: number;
  vehicles: { nickname: string; type: string } | null;
}

const MODE_ICONS: Record<string, string> = {
  bike: '🚲', car: '🚗', bus: '🚌', train: '🚂', plane: '✈️',
  walk: '🚶', run: '🏃', ferry: '⛴️', rideshare: '🚕', other: '🚐',
};

const VEHICLE_TYPE_TO_MODE: Record<string, string> = {
  car: 'car', bike: 'bike', ebike: 'bike',
  motorcycle: 'car', scooter: 'car', shoes: 'walk',
};

const MODE_COLORS: Record<string, string> = {
  bike: '#22c55e', car: '#ef4444', bus: '#3b82f6', train: '#8b5cf6',
  plane: '#f59e0b', walk: '#06b6d4', run: '#f97316', other: '#6b7280',
};

function fmt(n: number | null | undefined, decimals = 1) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function TravelPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [settings, setSettings] = useState<TravelSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Add trip modal state
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [tripForm, setTripForm] = useState({
    mode: 'bike', date: new Date().toISOString().split('T')[0],
    origin: '', destination: '', distance_miles: '', duration_min: '',
    purpose: 'commute', calories_burned: '', notes: '', vehicle_id: '',
    tax_category: 'personal', trip_category: 'travel', save_as_template: false, template_name: '',
  });
  const [savingTrip, setSavingTrip] = useState(false);

  // Add/edit vehicle modal state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    type: 'car', nickname: '', make: '', model: '', year: '', color: '',
    ownership_type: 'owned', trip_mode: '',
  });
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [showRetired, setShowRetired] = useState(false);
  const [templates, setTemplates] = useState<TripTemplate[]>([]);
  const [loggingTemplate, setLoggingTemplate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, vehiclesRes, tripsRes, settingsRes, tmplRes] = await Promise.all([
        offlineFetch('/api/travel/summary?months=6'),
        offlineFetch('/api/travel/vehicles?include_retired=true'),
        offlineFetch('/api/travel/trips?limit=10'),
        offlineFetch('/api/travel/settings'),
        offlineFetch('/api/travel/templates'),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (vehiclesRes.ok) {
        const { vehicles: v } = await vehiclesRes.json();
        setVehicles(v || []);
      }
      if (tripsRes.ok) {
        const { trips } = await tripsRes.json();
        setRecentTrips(trips || []);
      }
      if (settingsRes.ok) {
        const { settings: s } = await settingsRes.json();
        setSettings(s);
      }
      if (tmplRes.ok) setTemplates(await tmplRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logCommuteByBike = async () => {
    if (!settings?.commute_distance_miles) {
      setTripForm((f) => ({ ...f, mode: 'bike', purpose: 'commute' }));
      setShowAddTrip(true);
      return;
    }
    setSavingTrip(true);
    try {
      const calories = settings.commute_duration_min
        ? Math.round(settings.commute_duration_min * 8) // ~8 cal/min cycling
        : null;
      await offlineFetch('/api/travel/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'bike', purpose: 'commute',
          date: new Date().toISOString().split('T')[0],
          distance_miles: settings.commute_distance_miles,
          duration_min: settings.commute_duration_min,
          calories_burned: calories,
          trip_category: 'travel',
          tax_category: 'personal',
        }),
      });
      load();
    } finally {
      setSavingTrip(false);
    }
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTrip(true);
    try {
      const res = await offlineFetch('/api/travel/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: tripForm.mode,
          date: tripForm.date,
          origin: tripForm.origin || null,
          destination: tripForm.destination || null,
          distance_miles: tripForm.distance_miles ? parseFloat(tripForm.distance_miles) : null,
          duration_min: tripForm.duration_min ? parseInt(tripForm.duration_min) : null,
          purpose: tripForm.purpose || null,
          calories_burned: tripForm.calories_burned ? parseInt(tripForm.calories_burned) : null,
          notes: tripForm.notes || null,
          vehicle_id: tripForm.vehicle_id || null,
          tax_category: tripForm.tax_category || 'personal',
          trip_category: tripForm.trip_category || 'travel',
        }),
      });
      if (res.ok) {
        // Optionally save as template
        if (tripForm.save_as_template && tripForm.template_name.trim()) {
          await offlineFetch('/api/travel/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: tripForm.template_name.trim(),
              mode: tripForm.mode,
              vehicle_id: tripForm.vehicle_id || null,
              origin: tripForm.origin || null,
              destination: tripForm.destination || null,
              distance_miles: tripForm.distance_miles ? parseFloat(tripForm.distance_miles) : null,
              duration_min: tripForm.duration_min ? parseInt(tripForm.duration_min) : null,
              purpose: tripForm.purpose || null,
              trip_category: tripForm.trip_category || 'travel',
              tax_category: tripForm.tax_category || 'personal',
            }),
          });
        }
        setShowAddTrip(false);
        setTripForm({ mode: 'bike', date: new Date().toISOString().split('T')[0], origin: '', destination: '', distance_miles: '', duration_min: '', purpose: 'commute', calories_burned: '', notes: '', vehicle_id: '', tax_category: 'personal', trip_category: 'travel', save_as_template: false, template_name: '' });
        load();
      }
    } finally {
      setSavingTrip(false);
    }
  };

  const handleEditVehicle = (v: Vehicle) => {
    setEditingVehicle(v);
    setVehicleForm({
      type: v.type,
      nickname: v.nickname,
      make: v.make ?? '',
      model: v.model ?? '',
      year: v.year != null ? String(v.year) : '',
      color: '',
      ownership_type: v.ownership_type || 'owned',
      trip_mode: v.trip_mode ?? '',
    });
    setShowAddVehicle(true);
  };

  const handleRetireVehicle = async (id: string) => {
    if (!confirm('Retire this vehicle? All your data will be preserved and you can reactivate it later.')) return;
    await offlineFetch('/api/travel/vehicles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, retire: true }),
    });
    load();
  };

  const handleReactivateVehicle = async (id: string) => {
    await offlineFetch('/api/travel/vehicles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reactivate: true }),
    });
    load();
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm('Delete this vehicle? This will not delete its logs.')) return;
    await offlineFetch('/api/travel/vehicles', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVehicle(true);
    try {
      const payload = {
        ...(editingVehicle ? { id: editingVehicle.id } : {}),
        type: vehicleForm.type,
        nickname: vehicleForm.nickname,
        make: vehicleForm.make || null,
        model: vehicleForm.model || null,
        year: vehicleForm.year ? parseInt(vehicleForm.year) : null,
        color: vehicleForm.color || null,
        ownership_type: vehicleForm.ownership_type || 'owned',
        trip_mode: vehicleForm.trip_mode || null,
      };
      const res = await offlineFetch('/api/travel/vehicles', {
        method: editingVehicle ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowAddVehicle(false);
        setEditingVehicle(null);
        setVehicleForm({ type: 'car', nickname: '', make: '', model: '', year: '', color: '', ownership_type: 'owned', trip_mode: '' });
        load();
      }
    } finally {
      setSavingVehicle(false);
    }
  };

  const logFromTemplate = async (tmpl: TripTemplate) => {
    setLoggingTemplate(tmpl.id);
    try {
      const res = await offlineFetch('/api/travel/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          create_trip: true,
          template_id: tmpl.id,
          name: tmpl.name,
          mode: tmpl.mode,
        }),
      });
      if (res.ok) load();
    } finally {
      setLoggingTemplate(null);
    }
  };

  const cm = summary?.currentMonth;
  const totalMilesMonth = Object.values(cm?.milesByMode ?? {}).reduce((s, v) => s + v, 0);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your miles, fuel, and commute impact</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={logCommuteByBike}
            disabled={savingTrip}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            <Bike className="w-4 h-4" />
            Log Commute
          </button>
          <button
            onClick={() => setShowAddTrip(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Trip
          </button>
        </div>
      </div>

      {/* Setup prompt if no vehicles */}
      {vehicles.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Set up your vehicles first</p>
            <p className="text-xs text-amber-700 mt-1">Add your car and bike to unlock fuel tracking, maintenance logs, and savings analysis.</p>
            <button
              onClick={() => setShowAddVehicle(true)}
              className="mt-2 text-xs font-medium text-amber-800 underline"
            >
              Add a vehicle
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bike className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-gray-500">Bike Miles</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(cm?.bikeMiles)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{cm?.bikeCommuteDays ?? 0} commute days</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-gray-500">Bike Savings</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmtMoney(cm?.bikeSavings)}</p>
          <p className="text-xs text-gray-400 mt-0.5">vs. driving this month</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Leaf className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-medium text-gray-500">CO₂ Saved</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(cm?.co2SavedKgVsCar)} kg</p>
          <p className="text-xs text-gray-400 mt-0.5">by biking vs. driving</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-gray-500">Commute Cals</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {fmt(cm?.calsByMode?.['bike'] ?? 0, 0)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">burned biking</p>
        </div>
      </div>

      {/* Fuel stats if we have data */}
      {(cm?.fuelSpend ?? 0) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Car className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-gray-500">Fuel Spend</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmtMoney(cm?.fuelSpend)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmt(cm?.fuelGallons, 2)} gallons</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium text-gray-500">Avg MPG</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{cm?.avgMpg != null ? fmt(cm.avgMpg, 1) : '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">this month</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Car className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-medium text-gray-500">Car Miles</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(cm?.carMiles)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {cm?.carCostPerMile != null ? `$${fmt(cm.carCostPerMile, 3)}/mile` : 'this month'}
            </p>
          </div>
        </div>
      )}

      {/* Miles by mode breakdown */}
      {totalMilesMonth > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Miles by Mode — This Month</h2>
          <div className="space-y-2">
            {Object.entries(cm?.milesByMode ?? {})
              .sort(([, a], [, b]) => b - a)
              .map(([mode, miles]) => {
                const pct = totalMilesMonth > 0 ? (miles / totalMilesMonth) * 100 : 0;
                return (
                  <div key={mode} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center">{MODE_ICONS[mode] ?? '🚐'}</span>
                    <span className="text-sm text-gray-700 w-16 capitalize">{mode}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: MODE_COLORS[mode] ?? '#6b7280' }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-16 text-right">{fmt(miles)} mi</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Charts */}
      {(summary?.monthlyTrend?.length ?? 0) > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Miles</h2>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary!.monthlyTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.substring(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={(v: any) => [`${fmt(Number(v))} mi`]} />
                  <Bar dataKey="bike_miles" fill="#22c55e" name="Bike" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="car_miles" fill="#ef4444" name="Car" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {(summary?.mpgTrend?.length ?? 0) > 1 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">MPG Trend</h2>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary!.mpgTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.substring(5)} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={(v: any) => [`${fmt(Number(v), 1)} MPG`]} />
                    <Line type="monotone" dataKey="mpg" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Maintenance Alerts */}
      {(summary?.maintenanceAlerts?.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-amber-800 mb-3">Service Reminders</h2>
          <div className="space-y-2">
            {summary!.maintenanceAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between text-sm">
                <span className="text-amber-900">
                  {alert.vehicle?.nickname ?? 'Vehicle'} — {alert.service_type.replace('_', ' ')}
                </span>
                <span className="text-amber-700 font-medium">
                  {alert.next_service_date ?? `@ ${alert.next_service_miles?.toLocaleString()} mi`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vehicles */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Vehicles</h2>
          <button
            onClick={() => { setVehicleForm({ type: 'car', nickname: '', make: '', model: '', year: '', color: '', ownership_type: 'owned', trip_mode: '' }); setEditingVehicle(null); setShowAddVehicle(true); }}
            className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        {vehicles.filter((v) => v.active).length === 0 && vehicles.filter((v) => !v.active).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No vehicles yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vehicles.filter((v) => v.active).map((v) => (
                <div key={v.id} className="border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl">{v.type === 'car' ? '🚗' : v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡🚲' : v.type === 'shoes' ? '👟' : '🛵'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{v.nickname}</p>
                      {v.ownership_type === 'rental' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Rental</span>
                      )}
                      {v.ownership_type === 'borrowed' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Borrowed</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {[v.year, v.make, v.model].filter(Boolean).join(' ') || v.type}
                      {v.latest_odometer != null && ` · ${v.latest_odometer.toLocaleString()} mi`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleEditVehicle(v)} className="text-xs text-sky-500 hover:text-sky-700 transition">edit</button>
                    {v.ownership_type === 'owned' && (
                      <button onClick={() => handleRetireVehicle(v.id)} className="text-xs text-gray-400 hover:text-gray-600 transition">retire</button>
                    )}
                    <button onClick={() => handleDeleteVehicle(v.id)} className="text-xs text-red-400 hover:text-red-600 transition">del</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Retired vehicles toggle */}
            {vehicles.filter((v) => !v.active).length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowRetired((s) => !s)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition font-medium"
                >
                  {showRetired ? 'Hide' : 'Show'} retired vehicles ({vehicles.filter((v) => !v.active).length})
                </button>
                {showRetired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {vehicles.filter((v) => !v.active).map((v) => (
                      <div key={v.id} className="border border-gray-100 rounded-xl p-3 flex items-center gap-3 opacity-50">
                        <span className="text-2xl grayscale">{v.type === 'car' ? '🚗' : v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡🚲' : v.type === 'shoes' ? '👟' : '🛵'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-500">{v.nickname}</p>
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">Retired</span>
                          </div>
                          <p className="text-xs text-gray-400">
                            {[v.year, v.make, v.model].filter(Boolean).join(' ') || v.type}
                          </p>
                        </div>
                        <button
                          onClick={() => handleReactivateVehicle(v.id)}
                          className="text-xs text-sky-500 hover:text-sky-700 transition shrink-0"
                        >
                          reactivate
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Recent Trips */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Recent Trips</h2>
          <Link href="/dashboard/travel/trips" className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {recentTrips.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No trips logged yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentTrips.map((trip) => (
              <div key={trip.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{MODE_ICONS[trip.mode] ?? '🚐'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {trip.origin && trip.destination
                        ? `${trip.origin} → ${trip.destination}`
                        : `${trip.mode} trip`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {trip.date}
                      {trip.distance_miles ? ` · ${fmt(trip.distance_miles)} mi` : ''}
                      {trip.duration_min ? ` · ${trip.duration_min} min` : ''}
                    </p>
                  </div>
                </div>
                {trip.calories_burned ? (
                  <span className="text-xs text-orange-600 font-medium">{trip.calories_burned} cal</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trip Templates */}
      {templates.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Quick Re-log</h2>
            <span className="text-xs text-gray-400">{templates.length} saved templates</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templates.slice(0, 6).map((t) => (
              <button
                key={t.id}
                onClick={() => logFromTemplate(t)}
                disabled={loggingTemplate === t.id}
                className="flex items-center gap-3 border border-gray-100 rounded-xl p-3 text-left hover:bg-gray-50 transition disabled:opacity-50"
              >
                <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                  <p className="text-xs text-gray-500">
                    {MODE_ICONS[t.mode] ?? '🚐'} {t.mode}
                    {t.distance_miles ? ` · ${fmt(t.distance_miles)} mi` : ''}
                    {t.use_count > 0 ? ` · ${t.use_count}x` : ''}
                  </p>
                </div>
                <Repeat className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: '/dashboard/travel/fuel', icon: <Gauge className="w-5 h-5" />, label: 'Fuel Log', color: 'text-blue-600' },
          { href: '/dashboard/travel/maintenance', icon: <Car className="w-5 h-5" />, label: 'Maintenance', color: 'text-orange-600' },
          { href: '/dashboard/travel/components', icon: <Wrench className="w-5 h-5" />, label: 'Component Wear', color: 'text-amber-600' },
          { href: '/dashboard/travel/import', icon: <Upload className="w-5 h-5" />, label: 'Import Data', color: 'text-purple-600' },
          { href: '/api/travel/trips/export', icon: <Download className="w-5 h-5" />, label: 'Export Trips', color: 'text-indigo-600' },
          { href: '/dashboard/travel/trips', icon: <Zap className="w-5 h-5" />, label: 'All Trips', color: 'text-green-600' },
          { href: '/dashboard/workouts', icon: <Repeat className="w-5 h-5" />, label: 'Workouts', color: 'text-lime-600' },
        ].map(({ href, icon, label, color }) => (
          <Link
            key={href}
            href={href}
            className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 hover:bg-gray-50 transition"
          >
            <span className={color}>{icon}</span>
            <span className="text-xs font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>

      {/* Add Trip Modal */}
      <Modal isOpen={showAddTrip} onClose={() => setShowAddTrip(false)} title="Log Trip" size="sm">
        <form onSubmit={handleSaveTrip}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="qtrip-mode" className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
                <select
                  id="qtrip-mode"
                  value={tripForm.mode}
                  onChange={(e) => setTripForm((f) => ({ ...f, mode: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {['bike','car','bus','train','plane','walk','run','ferry','rideshare','other'].map((m) => (
                    <option key={m} value={m}>{MODE_ICONS[m]} {m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="qtrip-date" className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  id="qtrip-date"
                  type="date" value={tripForm.date}
                  onChange={(e) => setTripForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  required
                  aria-required="true"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="qtrip-origin" className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input
                  id="qtrip-origin"
                  type="text" value={tripForm.origin} placeholder="Origin"
                  onChange={(e) => setTripForm((f) => ({ ...f, origin: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="qtrip-destination" className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <input
                  id="qtrip-destination"
                  type="text" value={tripForm.destination} placeholder="Destination"
                  onChange={(e) => setTripForm((f) => ({ ...f, destination: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="qtrip-miles" className="block text-xs font-medium text-gray-600 mb-1">Miles</label>
                <input
                  id="qtrip-miles"
                  type="number" step="0.01" value={tripForm.distance_miles} placeholder="0.0"
                  onChange={(e) => setTripForm((f) => ({ ...f, distance_miles: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="qtrip-duration" className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                <input
                  id="qtrip-duration"
                  type="number" value={tripForm.duration_min} placeholder="0"
                  onChange={(e) => setTripForm((f) => ({ ...f, duration_min: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="qtrip-calories" className="block text-xs font-medium text-gray-600 mb-1">Calories</label>
                <input
                  id="qtrip-calories"
                  type="number" value={tripForm.calories_burned} placeholder="0"
                  onChange={(e) => setTripForm((f) => ({ ...f, calories_burned: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="qtrip-purpose" className="block text-xs font-medium text-gray-600 mb-1">Purpose</label>
                <select
                  id="qtrip-purpose"
                  value={tripForm.purpose}
                  onChange={(e) => setTripForm((f) => ({ ...f, purpose: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {['commute','leisure','work','errand','exercise','other'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="qtrip-tax" className="block text-xs font-medium text-gray-600 mb-1">Tax purpose</label>
                <select
                  id="qtrip-tax"
                  value={tripForm.tax_category}
                  onChange={(e) => setTripForm((f) => ({ ...f, tax_category: e.target.value }))}
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
            {['bike','walk','run','other'].includes(tripForm.mode) && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trip type</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => setTripForm((f) => ({ ...f, trip_category: 'travel' }))}
                    className={`flex-1 py-2 font-medium transition ${tripForm.trip_category === 'travel' ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Travel
                  </button>
                  <button
                    type="button"
                    onClick={() => setTripForm((f) => ({ ...f, trip_category: 'fitness' }))}
                    className={`flex-1 py-2 font-medium transition ${tripForm.trip_category === 'fitness' ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Fitness
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Travel counts toward commute savings. Fitness is for workouts.</p>
              </div>
            )}
            {vehicles.filter((v) => v.active).length > 0 && (
              <div>
                <label htmlFor="qtrip-vehicle" className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                <select
                  id="qtrip-vehicle"
                  value={tripForm.vehicle_id}
                  onChange={(e) => {
                    const vid = e.target.value;
                    const v = vehicles.find((veh) => veh.id === vid);
                    const autoMode = v ? (v.trip_mode || VEHICLE_TYPE_TO_MODE[v.type]) : undefined;
                    setTripForm((f) => ({
                      ...f,
                      vehicle_id: vid,
                      ...(autoMode ? { mode: autoMode } : {}),
                    }));
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {vehicles.filter((v) => v.active).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nickname}{v.ownership_type !== 'owned' ? ` (${v.ownership_type})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="qtrip-notes" className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                id="qtrip-notes"
                type="text" value={tripForm.notes} placeholder="Optional notes"
                onChange={(e) => setTripForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            {/* Save as template */}
            <div className="border border-gray-100 rounded-lg p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tripForm.save_as_template}
                  onChange={(e) => setTripForm((f) => ({ ...f, save_as_template: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-xs font-medium text-gray-600">Save as template for quick re-logging</span>
              </label>
              {tripForm.save_as_template && (
                <input
                  id="qtrip-template-name"
                  type="text"
                  value={tripForm.template_name}
                  onChange={(e) => setTripForm((f) => ({ ...f, template_name: e.target.value }))}
                  placeholder="Template name (e.g. Morning Commute)"
                  className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  required={tripForm.save_as_template}
                  aria-required={tripForm.save_as_template}
                />
              )}
            </div>
          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 pt-3 pb-3 flex gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => setShowAddTrip(false)}
              className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={savingTrip}
              className="flex-1 bg-sky-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50">
              {savingTrip ? 'Saving...' : 'Save Trip'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Vehicle Modal */}
      <Modal isOpen={showAddVehicle} onClose={() => { setShowAddVehicle(false); setEditingVehicle(null); setVehicleForm({ type: 'car', nickname: '', make: '', model: '', year: '', color: '', ownership_type: 'owned', trip_mode: '' }); }} title={editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'} size="sm">
        <form onSubmit={handleSaveVehicle}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="veh-type" className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  id="veh-type"
                  value={vehicleForm.type}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {['car','bike','ebike','motorcycle','scooter','shoes'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="veh-ownership" className="block text-xs font-medium text-gray-600 mb-1">Ownership</label>
                <select
                  id="veh-ownership"
                  value={vehicleForm.ownership_type}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, ownership_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="owned">Owned</option>
                  <option value="rental">Rental</option>
                  <option value="borrowed">Borrowed</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="veh-trip-mode" className="block text-xs font-medium text-gray-600 mb-1">Trip Mode</label>
              <select
                id="veh-trip-mode"
                value={vehicleForm.trip_mode}
                onChange={(e) => setVehicleForm((f) => ({ ...f, trip_mode: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Auto (from type)</option>
                {['bike','car','bus','train','plane','walk','run','ferry','rideshare','other'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-0.5">Auto-fills trip mode when logging trips</p>
            </div>
            <div>
              <label htmlFor="veh-nickname" className="block text-xs font-medium text-gray-600 mb-1">Nickname *</label>
              <input
                id="veh-nickname"
                type="text" value={vehicleForm.nickname} placeholder="My Camry"
                onChange={(e) => setVehicleForm((f) => ({ ...f, nickname: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                required
                aria-required="true"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="veh-year" className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                <input
                  id="veh-year"
                  type="number" value={vehicleForm.year} placeholder="2020"
                  onChange={(e) => setVehicleForm((f) => ({ ...f, year: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="veh-make" className="block text-xs font-medium text-gray-600 mb-1">Make</label>
                <input
                  id="veh-make"
                  type="text" value={vehicleForm.make} placeholder="Toyota"
                  onChange={(e) => setVehicleForm((f) => ({ ...f, make: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="veh-model" className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                <input
                  id="veh-model"
                  type="text" value={vehicleForm.model} placeholder="Camry"
                  onChange={(e) => setVehicleForm((f) => ({ ...f, model: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 pt-3 pb-3 flex gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => { setShowAddVehicle(false); setEditingVehicle(null); setVehicleForm({ type: 'car', nickname: '', make: '', model: '', year: '', color: '', ownership_type: 'owned', trip_mode: '' }); }}
              className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={savingVehicle}
              className="flex-1 bg-sky-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50">
              {savingVehicle ? 'Saving...' : editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
