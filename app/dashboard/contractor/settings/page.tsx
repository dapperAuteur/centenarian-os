'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, MapPin, Save, CheckCircle, AlertTriangle, RotateCcw, Sparkles,
} from 'lucide-react';
import TourRestartButton from '@/components/onboarding/TourRestartButton';

interface TravelSettings {
  home_address: string | null;
  home_lat: number | null;
  home_lng: number | null;
  distance_unit: 'mi' | 'km';
}

interface TourStatus {
  module_slug: string;
  app: string;
  status: 'available' | 'in_progress' | 'completed' | 'skipped';
}

export default function ContractorSettingsPage() {
  const [settings, setSettings] = useState<TravelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [address, setAddress] = useState('');
  const [unit, setUnit] = useState<'mi' | 'km'>('mi');
  const [tours, setTours] = useState<TourStatus[]>([]);

  const loadTours = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding/status');
      if (res.ok) {
        const d = await res.json();
        setTours((d.tours ?? []).filter((t: TourStatus) => t.app === 'contractor'));
      }
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/travel/settings');
    if (res.ok) {
      const d = await res.json();
      const s = d.settings;
      if (s) {
        setSettings(s);
        setAddress(s.home_address ?? '');
        setUnit(s.distance_unit ?? 'mi');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); loadTours(); }, [load, loadTours]);

  async function saveHomeAddress() {
    if (!address.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    setGeocoding(true);

    const res = await fetch('/api/contractor/distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address.trim(),
        save_as_home: true,
        distance_unit: unit,
      }),
    });

    setGeocoding(false);
    setSaving(false);

    if (res.ok) {
      const d = await res.json();
      setSuccess(`Home address saved. Geocoded to ${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}`);
      setSettings((prev) => prev ? {
        ...prev,
        home_address: address.trim(),
        home_lat: d.lat,
        home_lng: d.lng,
        distance_unit: unit,
      } : null);
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed to geocode address');
    }
  }

  async function saveUnitOnly() {
    setSaving(true);
    setError('');
    setSuccess('');

    // Save just the distance unit via the travel settings API
    const res = await fetch('/api/travel/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distance_unit: unit }),
    });

    setSaving(false);
    if (res.ok) {
      setSuccess('Distance unit updated.');
    } else {
      setError('Failed to update distance unit.');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-neutral-500" size={28} aria-label="Loading..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-bold text-neutral-100">Contractor Settings</h1>

      {/* Home Address */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-amber-400" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-neutral-100">Home Address</h2>
        </div>
        <p className="text-sm text-neutral-400">
          Set your home address to auto-calculate mileage to job venues. Your address is geocoded
          using OpenStreetMap (open-source, no tracking). Only the address text is sent — nothing else.
        </p>

        <label className="block">
          <span className="text-xs font-medium text-neutral-400">Address</span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            placeholder="123 Main St, Indianapolis, IN 46204"
          />
        </label>

        {settings?.home_lat && settings?.home_lng && (
          <p className="text-xs text-neutral-500">
            Current coordinates: {settings.home_lat.toFixed(4)}, {settings.home_lng.toFixed(4)}
          </p>
        )}

        <div className="flex gap-3 items-end">
          <button
            onClick={saveHomeAddress}
            disabled={saving || !address.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
          >
            {geocoding ? <Loader2 size={14} className="animate-spin" aria-label="Loading..." /> : <Save size={14} aria-hidden="true" />}
            {geocoding ? 'Geocoding...' : 'Save Home Address'}
          </button>
        </div>
      </section>

      {/* Distance Unit */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-100">Distance Unit</h2>
        <p className="text-sm text-neutral-400">
          Choose miles or kilometers for distance calculations.
        </p>

        <div className="flex gap-2" role="radiogroup" aria-label="Distance unit">
          {[
            { id: 'mi' as const, label: 'Miles (mi)' },
            { id: 'km' as const, label: 'Kilometers (km)' },
          ].map((opt) => (
            <button
              key={opt.id}
              role="radio"
              aria-checked={unit === opt.id}
              onClick={() => setUnit(opt.id)}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                unit === opt.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={saveUnitOnly}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
        >
          <Save size={14} aria-hidden="true" />
          Update Unit
        </button>
      </section>

      {/* Module Tours */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-400" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-neutral-100">Module Tours</h2>
        </div>
        <p className="text-sm text-neutral-400">
          Re-take any feature walkthrough to refresh your memory.
        </p>

        {tours.length > 0 ? (
          <div className="space-y-2">
            {tours.map((t) => (
              <div
                key={t.module_slug}
                className="flex items-center justify-between rounded-lg bg-neutral-800 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-200 capitalize">
                    {t.module_slug.replace(/-/g, ' ')}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    t.status === 'completed'
                      ? 'bg-green-900/40 text-green-400'
                      : t.status === 'in_progress'
                        ? 'bg-amber-900/40 text-amber-400'
                        : t.status === 'skipped'
                          ? 'bg-neutral-700 text-neutral-400'
                          : 'bg-neutral-700 text-neutral-500'
                  }`}>
                    {t.status === 'in_progress' ? 'in progress' : t.status}
                  </span>
                </div>
                <TourRestartButton
                  app="contractor"
                  moduleSlug={t.module_slug}
                  label="Restart"
                  onReset={loadTours}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No tours started yet. Explore features to begin.</p>
        )}

        {tours.length > 0 && (
          <TourRestartButton
            app="contractor"
            label="Restart All Tours"
            onReset={loadTours}
          />
        )}
      </section>

      {/* Feedback */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-700/50 bg-green-900/20 px-4 py-3" role="status">
          <CheckCircle size={16} className="text-green-400 shrink-0" aria-hidden="true" />
          <p className="text-sm text-green-300">{success}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-700/50 bg-red-900/20 px-4 py-3" role="alert">
          <AlertTriangle size={16} className="text-red-400 shrink-0" aria-hidden="true" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <p className="text-xs text-neutral-500">
        Distance is estimated using the Haversine formula with a 1.3x driving multiplier.
        Accurate within ~10-20% of actual driving distance.
      </p>
    </div>
  );
}
