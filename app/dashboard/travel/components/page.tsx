'use client';

// app/dashboard/travel/components/page.tsx
// Tire, shoe, chain, and other component wear tracking

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, AlertTriangle, CheckCircle2, Trash2, Archive } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Vehicle {
  id: string;
  nickname: string;
  type: string;
  latest_odometer: number | null;
}

interface Component {
  id: string;
  vehicle_id: string;
  component_type: string;
  brand: string | null;
  model: string | null;
  installed_date: string;
  installed_miles: number;
  expected_life_miles: number | null;
  retired_date: string | null;
  retired_miles: number | null;
  current_miles: number | null;
  wear_pct: number | null;
  notes: string | null;
  vehicles: { nickname: string; type: string } | null;
}

const COMPONENT_TYPES = [
  { value: 'front_tire', label: 'Front Tire' },
  { value: 'rear_tire', label: 'Rear Tire' },
  { value: 'all_tires', label: 'All Tires (set)' },
  { value: 'chain', label: 'Chain' },
  { value: 'brake_pads', label: 'Brake Pads' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'other', label: 'Other' },
];

const TYPE_EMOJI: Record<string, string> = {
  front_tire: '🛞', rear_tire: '🛞', all_tires: '🛞',
  chain: '⛓️', brake_pads: '🛑', shoes: '👟', other: '🔧',
};

function wearColor(pct: number | null): string {
  if (pct == null) return 'bg-gray-200';
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 75) return 'bg-amber-500';
  return 'bg-green-500';
}

function wearLabel(pct: number | null): string {
  if (pct == null) return 'Unknown';
  if (pct >= 100) return 'Replace';
  if (pct >= 75) return 'Worn';
  return 'Good';
}

export default function ComponentWearPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRetired, setShowRetired] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vehicle_id: '', component_type: 'front_tire', brand: '', model: '',
    installed_date: new Date().toISOString().split('T')[0],
    installed_miles: '0', expected_life_miles: '', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, vehRes] = await Promise.all([
        offlineFetch('/api/travel/components?include_retired=true'),
        offlineFetch('/api/travel/vehicles'),
      ]);
      if (compRes.ok) setComponents(await compRes.json());
      if (vehRes.ok) {
        const { vehicles: v } = await vehRes.json();
        setVehicles(v ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Enrich current_miles from vehicle odometer for active components
  const enriched = components.map((c) => {
    if (c.retired_date) return c;
    const vehicle = vehicles.find((v) => v.id === c.vehicle_id);
    if (!vehicle?.latest_odometer) return c;
    const currentMiles = vehicle.latest_odometer - c.installed_miles;
    const wearPct = c.expected_life_miles ? Math.round((currentMiles / c.expected_life_miles) * 100) : null;
    return { ...c, current_miles: currentMiles > 0 ? currentMiles : null, wear_pct: wearPct };
  });

  const active = enriched.filter((c) => !c.retired_date);
  const retired = enriched.filter((c) => c.retired_date);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await offlineFetch('/api/travel/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: form.vehicle_id,
          component_type: form.component_type,
          brand: form.brand || null,
          model: form.model || null,
          installed_date: form.installed_date,
          installed_miles: Number(form.installed_miles) || 0,
          expected_life_miles: form.expected_life_miles ? Number(form.expected_life_miles) : null,
          notes: form.notes || null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ vehicle_id: '', component_type: 'front_tire', brand: '', model: '', installed_date: new Date().toISOString().split('T')[0], installed_miles: '0', expected_life_miles: '', notes: '' });
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRetire = async (c: Component) => {
    const vehicle = vehicles.find((v) => v.id === c.vehicle_id);
    const miles = vehicle?.latest_odometer ?? undefined;
    if (!confirm(`Retire this ${COMPONENT_TYPES.find((t) => t.value === c.component_type)?.label ?? c.component_type}${miles ? ` at ${miles.toLocaleString()} miles` : ''}?`)) return;
    await offlineFetch(`/api/travel/components/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retire: true, retired_miles: miles }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this component record?')) return;
    await offlineFetch(`/api/travel/components/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-amber-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const needsAttention = active.filter((c) => c.wear_pct != null && c.wear_pct >= 75);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/travel" className="p-2 text-gray-400 hover:text-gray-600 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Component Wear</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track tires, shoes, chains & more</p>
          </div>
        </div>
        <button
          onClick={() => { setForm((f) => ({ ...f, vehicle_id: vehicles[0]?.id ?? '' })); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition"
        >
          <Plus className="w-4 h-4" /> Add Component
        </button>
      </div>

      {/* Alerts */}
      {needsAttention.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-sm font-semibold text-red-800">Needs Replacement</h2>
          </div>
          <div className="space-y-1.5">
            {needsAttention.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-red-900">
                  {c.vehicles?.nickname ?? 'Vehicle'} — {COMPONENT_TYPES.find((t) => t.value === c.component_type)?.label ?? c.component_type}
                  {c.brand ? ` (${c.brand})` : ''}
                </span>
                <span className="text-red-700 font-medium">{c.wear_pct}% worn · {c.current_miles?.toLocaleString()} mi</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Components */}
      {vehicles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Add a vehicle first to start tracking components.</p>
          <Link href="/dashboard/travel" className="mt-2 inline-block text-sm text-amber-600 font-medium hover:text-amber-700">
            Go to Travel
          </Link>
        </div>
      ) : active.length === 0 && retired.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">No components tracked yet.</p>
          <button onClick={() => { setForm((f) => ({ ...f, vehicle_id: vehicles[0]?.id ?? '' })); setShowForm(true); }}
            className="mt-2 text-sm text-amber-600 font-medium hover:text-amber-700">
            Add your first component
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {active.map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{TYPE_EMOJI[c.component_type] ?? '🔧'}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {COMPONENT_TYPES.find((t) => t.value === c.component_type)?.label ?? c.component_type}
                      </p>
                      <p className="text-xs text-gray-500">{c.vehicles?.nickname ?? 'Vehicle'}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${wearColor(c.wear_pct)}`}>
                    {wearLabel(c.wear_pct)}
                  </span>
                </div>

                {c.brand && <p className="text-xs text-gray-500 mb-2">{[c.brand, c.model].filter(Boolean).join(' ')}</p>}

                {/* Wear bar */}
                {c.expected_life_miles && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{c.current_miles?.toLocaleString() ?? '?'} mi</span>
                      <span>{c.expected_life_miles.toLocaleString()} mi expected</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${wearColor(c.wear_pct)}`}
                        style={{ width: `${Math.min(c.wear_pct ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400">Installed {c.installed_date} at {c.installed_miles.toLocaleString()} mi</p>
                {c.notes && <p className="text-xs text-gray-400 mt-1">{c.notes}</p>}

                <div className="flex gap-3 mt-3 pt-2 border-t border-gray-100">
                  <button onClick={() => handleRetire(c)} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
                    <Archive className="w-3 h-3" /> Retire
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Retired */}
          {retired.length > 0 && (
            <div>
              <button onClick={() => setShowRetired((s) => !s)} className="text-xs text-gray-400 hover:text-gray-600 font-medium">
                {showRetired ? 'Hide' : 'Show'} retired components ({retired.length})
              </button>
              {showRetired && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {retired.map((c) => {
                    const totalMiles = c.retired_miles != null ? c.retired_miles - c.installed_miles : null;
                    return (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4 opacity-60">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg grayscale">{TYPE_EMOJI[c.component_type] ?? '🔧'}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              {COMPONENT_TYPES.find((t) => t.value === c.component_type)?.label ?? c.component_type}
                            </p>
                            <p className="text-xs text-gray-400">{c.vehicles?.nickname}</p>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                        </div>
                        <p className="text-xs text-gray-400">
                          {c.brand ? `${c.brand} · ` : ''}
                          {totalMiles != null ? `${totalMiles.toLocaleString()} mi total` : ''}
                          {c.retired_date ? ` · Retired ${c.retired_date}` : ''}
                        </p>
                        <button onClick={() => handleDelete(c.id)} className="text-xs text-red-400 hover:text-red-600 mt-2">Delete</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Component Modal */}
      {showForm && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Add Component</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle *</label>
                <select value={form.vehicle_id} onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">Select…</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
                <select value={form.component_type} onChange={(e) => setForm((f) => ({ ...f, component_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required>
                  {COMPONENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                <input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="e.g. Continental" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="e.g. GP5000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Installed date</label>
                <input type="date" value={form.installed_date}
                  onChange={(e) => setForm((f) => ({ ...f, installed_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Installed at (miles)</label>
                <input type="number" value={form.installed_miles}
                  onChange={(e) => setForm((f) => ({ ...f, installed_miles: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expected life (miles)</label>
              <input type="number" value={form.expected_life_miles}
                onChange={(e) => setForm((f) => ({ ...f, expected_life_miles: e.target.value }))}
                placeholder="e.g. 3000 for bike tires, 500 for running shoes"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-amber-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Component'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
