'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Vehicle {
  id: string;
  nickname: string;
  type: string;
  ownership_type: string;
  trip_mode: string | null;
}

interface TripTemplateStop {
  stop_order: number;
  location_name: string;
  mode: string | null;
  vehicle_id: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  cost: number | null;
  purpose: string | null;
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
  stops?: TripTemplateStop[];
}

const MODE_OPTIONS = ['bike', 'car', 'bus', 'train', 'plane', 'walk', 'run', 'ferry', 'rideshare', 'other'];
const MODE_ICONS: Record<string, string> = {
  bike: '🚲', car: '🚗', bus: '🚌', train: '🚂', plane: '✈️',
  walk: '🚶', run: '🏃', ferry: '⛴️', rideshare: '🚕', other: '🚐',
};

interface StopForm {
  location_name: string;
  mode: string;
  vehicle_id: string;
  distance_miles: string;
  duration_min: string;
  cost: string;
  purpose: string;
}

interface Props {
  template: TripTemplate;
  vehicles: Vehicle[];
  brands?: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

export default function EditTemplateModal({ template, vehicles, brands, onClose, onSaved }: Props) {
  const [name, setName] = useState(template.name);
  const [mode, setMode] = useState(template.mode || 'car');
  const [vehicleId, setVehicleId] = useState(template.vehicle_id || '');
  const [origin, setOrigin] = useState(template.origin || '');
  const [destination, setDestination] = useState(template.destination || '');
  const [distanceMiles, setDistanceMiles] = useState(template.distance_miles != null ? String(template.distance_miles) : '');
  const [durationMin, setDurationMin] = useState(template.duration_min != null ? String(template.duration_min) : '');
  const [cost, setCost] = useState(template.cost != null ? String(template.cost) : '');
  const [purpose, setPurpose] = useState(template.purpose || '');
  const [tripCategory, setTripCategory] = useState(template.trip_category || 'travel');
  const [taxCategory, setTaxCategory] = useState(template.tax_category || 'personal');
  const [notes, setNotes] = useState(template.notes || '');
  const [isRoundTrip, setIsRoundTrip] = useState(template.is_round_trip);
  const [brandId, setBrandId] = useState(template.brand_id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isMultiStop = template.is_multi_stop;

  // Multi-stop state
  const [stops, setStops] = useState<StopForm[]>(() => {
    if (!isMultiStop || !template.stops?.length) return [];
    return template.stops
      .slice()
      .sort((a, b) => a.stop_order - b.stop_order)
      .map((s) => ({
        location_name: s.location_name || '',
        mode: s.mode || '',
        vehicle_id: s.vehicle_id || '',
        distance_miles: s.distance_miles != null ? String(s.distance_miles) : '',
        duration_min: s.duration_min != null ? String(s.duration_min) : '',
        cost: s.cost != null ? String(s.cost) : '',
        purpose: s.purpose || '',
      }));
  });

  const updateStop = (idx: number, field: keyof StopForm, value: string) => {
    setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const removeStop = (idx: number) => {
    if (stops.length <= 2) return;
    setStops((prev) => prev.filter((_, i) => i !== idx));
  };

  const addStop = () => {
    setStops((prev) => [
      ...prev.slice(0, -1),
      { location_name: '', mode: prev[prev.length - 2]?.mode || mode, vehicle_id: '', distance_miles: '', duration_min: '', cost: '', purpose: '' },
      prev[prev.length - 1],
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required'); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        mode,
        vehicle_id: vehicleId || null,
        notes: notes.trim() || null,
        is_round_trip: isRoundTrip,
        brand_id: brandId || null,
        purpose: purpose.trim() || null,
        trip_category: tripCategory,
        tax_category: taxCategory,
      };

      if (isMultiStop) {
        body.stops = stops.map((s) => ({
          location_name: s.location_name.trim() || null,
          mode: s.mode || null,
          vehicle_id: s.vehicle_id || null,
          distance_miles: s.distance_miles ? parseFloat(s.distance_miles) : null,
          duration_min: s.duration_min ? parseInt(s.duration_min) : null,
          cost: s.cost ? parseFloat(s.cost) : null,
          purpose: s.purpose.trim() || null,
        }));
      } else {
        body.origin = origin.trim() || null;
        body.destination = destination.trim() || null;
        body.distance_miles = distanceMiles ? parseFloat(distanceMiles) : null;
        body.duration_min = durationMin ? parseInt(durationMin) : null;
        body.cost = cost ? parseFloat(cost) : null;
      }

      const res = await offlineFetch(`/api/travel/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error || 'Failed to save');
        return;
      }

      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <Modal isOpen onClose={onClose} title={`Edit Template`} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && <div role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        {/* Name */}
        <div>
          <label htmlFor="tmpl-name" className={labelCls}>Template Name</label>
          <input id="tmpl-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        {/* Mode + Vehicle */}
        {!isMultiStop && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tmpl-mode" className={labelCls}>Mode</label>
              <select id="tmpl-mode" className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{MODE_ICONS[m]} {m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tmpl-vehicle" className={labelCls}>Vehicle</label>
              <select id="tmpl-vehicle" className={inputCls} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">None</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.nickname}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Single-leg: Origin / Destination */}
        {!isMultiStop && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tmpl-origin" className={labelCls}>Origin</label>
                <input id="tmpl-origin" className={inputCls} value={origin} onChange={(e) => setOrigin(e.target.value)} />
              </div>
              <div>
                <label htmlFor="tmpl-dest" className={labelCls}>Destination</label>
                <input id="tmpl-dest" className={inputCls} value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="tmpl-dist" className={labelCls}>Distance (mi)</label>
                <input id="tmpl-dist" type="number" step="0.01" className={inputCls} value={distanceMiles} onChange={(e) => setDistanceMiles(e.target.value)} />
              </div>
              <div>
                <label htmlFor="tmpl-dur" className={labelCls}>Duration (min)</label>
                <input id="tmpl-dur" type="number" className={inputCls} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
              </div>
              <div>
                <label htmlFor="tmpl-cost" className={labelCls}>Cost ($)</label>
                <input id="tmpl-cost" type="number" step="0.01" className={inputCls} value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {/* Multi-stop: Stops list */}
        {isMultiStop && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={labelCls}>Stops</span>
              <button
                type="button"
                onClick={addStop}
                className="min-h-11 flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 font-medium transition"
                aria-label="Add stop"
              >
                <Plus className="w-3.5 h-3.5" /> Add Stop
              </button>
            </div>
            {stops.map((stop, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === stops.length - 1;
              return (
                <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-300 shrink-0" aria-hidden="true" />
                    <span className="text-xs font-medium text-gray-400 shrink-0 w-5">{idx + 1}</span>
                    <input
                      className={`${inputCls} flex-1`}
                      placeholder={isFirst ? 'Start location' : isLast ? 'End location' : 'Stop location'}
                      value={stop.location_name}
                      onChange={(e) => updateStop(idx, 'location_name', e.target.value)}
                      aria-label={`Stop ${idx + 1} location`}
                    />
                    {!isFirst && !isLast && stops.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeStop(idx)}
                        className="min-h-11 min-w-11 flex items-center justify-center text-red-400 hover:text-red-600 transition"
                        aria-label={`Remove stop ${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Leg details (shown for all stops except the first) */}
                  {!isFirst && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-9">
                      <select
                        className={inputCls}
                        value={stop.mode}
                        onChange={(e) => updateStop(idx, 'mode', e.target.value)}
                        aria-label={`Leg ${idx} mode`}
                      >
                        <option value="">Mode</option>
                        {MODE_OPTIONS.map((m) => (
                          <option key={m} value={m}>{MODE_ICONS[m]} {m.charAt(0).toUpperCase() + m.slice(1)}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        className={inputCls}
                        placeholder="Miles"
                        value={stop.distance_miles}
                        onChange={(e) => updateStop(idx, 'distance_miles', e.target.value)}
                        aria-label={`Leg ${idx} distance`}
                      />
                      <input
                        type="number"
                        className={inputCls}
                        placeholder="Min"
                        value={stop.duration_min}
                        onChange={(e) => updateStop(idx, 'duration_min', e.target.value)}
                        aria-label={`Leg ${idx} duration`}
                      />
                      <input
                        type="number"
                        step="0.01"
                        className={inputCls}
                        placeholder="Cost"
                        value={stop.cost}
                        onChange={(e) => updateStop(idx, 'cost', e.target.value)}
                        aria-label={`Leg ${idx} cost`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Round trip + Purpose */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 min-h-11">
            <input
              id="tmpl-rt"
              type="checkbox"
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              checked={isRoundTrip}
              onChange={(e) => setIsRoundTrip(e.target.checked)}
            />
            <label htmlFor="tmpl-rt" className="text-sm text-gray-700">Round trip</label>
          </div>
          <div>
            <label htmlFor="tmpl-purpose" className={labelCls}>Purpose</label>
            <select id="tmpl-purpose" className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="">None</option>
              <option value="commute">Commute</option>
              <option value="errand">Errand</option>
              <option value="leisure">Leisure</option>
              <option value="fitness">Fitness</option>
              <option value="business">Business</option>
            </select>
          </div>
        </div>

        {/* Category / Tax / Brand */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="tmpl-trip-cat" className={labelCls}>Category</label>
            <select id="tmpl-trip-cat" className={inputCls} value={tripCategory} onChange={(e) => setTripCategory(e.target.value)}>
              <option value="travel">Travel</option>
              <option value="fitness">Fitness</option>
            </select>
          </div>
          <div>
            <label htmlFor="tmpl-tax-cat" className={labelCls}>Tax Category</label>
            <select id="tmpl-tax-cat" className={inputCls} value={taxCategory} onChange={(e) => setTaxCategory(e.target.value)}>
              <option value="personal">Personal</option>
              <option value="business">Business</option>
              <option value="medical">Medical</option>
              <option value="charitable">Charitable</option>
            </select>
          </div>
          <div>
            <label htmlFor="tmpl-brand" className={labelCls}>Brand</label>
            <select id="tmpl-brand" className={inputCls} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">None</option>
              {brands?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="tmpl-notes" className={labelCls}>Notes</label>
          <textarea id="tmpl-notes" className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {/* Use count (read-only info) */}
        <p className="text-xs text-gray-400">Used {template.use_count} time{template.use_count !== 1 ? 's' : ''}</p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl min-h-11 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-sky-600 text-white rounded-xl min-h-11 text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
