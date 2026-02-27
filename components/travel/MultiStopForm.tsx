'use client';

import { useState } from 'react';
import { Plus, Trash2, ArrowDown } from 'lucide-react';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';

interface Vehicle {
  id: string;
  nickname: string;
  type: string;
  ownership_type: string;
  trip_mode: string | null;
}

interface Stop {
  location: string;
  mode: string;
  distance_miles: string;
  duration_min: string;
  cost: string;
  purpose: string;
  vehicle_id: string;
}

const MODE_OPTIONS = ['bike', 'car', 'bus', 'train', 'plane', 'walk', 'run', 'ferry', 'rideshare', 'other'];
const MODE_ICONS: Record<string, string> = {
  bike: '🚲', car: '🚗', bus: '🚌', train: '🚂', plane: '✈️',
  walk: '🚶', run: '🏃', ferry: '⛴️', rideshare: '🚕', other: '🚐',
};

const VEHICLE_TYPE_TO_MODE: Record<string, string> = {
  car: 'car', bike: 'bike', ebike: 'bike',
  motorcycle: 'car', scooter: 'car', shoes: 'walk',
};

const BLANK_STOP: Stop = {
  location: '',
  mode: 'car',
  distance_miles: '',
  duration_min: '',
  cost: '',
  purpose: 'errand',
  vehicle_id: '',
};

interface MultiStopFormProps {
  vehicles: Vehicle[];
  onClose: () => void;
  onSaved: () => void;
}

export default function MultiStopForm({ vehicles, onClose, onSaved }: MultiStopFormProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [stops, setStops] = useState<Stop[]>([
    { ...BLANK_STOP, mode: '' },  // First stop (origin) — no mode
    { ...BLANK_STOP },             // Second stop (first leg destination)
  ]);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const addStop = () => {
    setStops((s) => [...s, { ...BLANK_STOP }]);
  };

  const removeStop = (idx: number) => {
    if (stops.length <= 2) return;
    setStops((s) => s.filter((_, i) => i !== idx));
  };

  const updateStop = (idx: number, field: keyof Stop, value: string) => {
    setStops((s) => s.map((stop, i) => i === idx ? { ...stop, [field]: value } : stop));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Build legs from consecutive stops
      const legs = [];
      const effectiveStops = isRoundTrip && stops.length >= 2 && stops[stops.length - 1].location !== stops[0].location
        ? [...stops, { ...stops[stops.length - 1], location: stops[0].location }]
        : stops;

      for (let i = 0; i < effectiveStops.length - 1; i++) {
        const from = effectiveStops[i];
        const to = effectiveStops[i + 1];
        legs.push({
          mode: to.mode || 'car',
          origin: from.location || null,
          destination: to.location || null,
          distance_miles: to.distance_miles ? parseFloat(to.distance_miles) : null,
          duration_min: to.duration_min ? parseInt(to.duration_min) : null,
          cost: to.cost ? parseFloat(to.cost) : null,
          purpose: to.purpose || null,
          vehicle_id: to.vehicle_id || null,
        });
      }

      const res = await fetch('/api/travel/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          date,
          legs,
          notes: notes.trim() || null,
          is_round_trip: isRoundTrip,
          save_as_template: saveTemplate && name.trim(),
        }),
      });

      if (res.ok) {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-gray-900">Multi-Stop Route</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Route Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Errands"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        {/* Stops */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">Stops</label>
          {stops.map((stop, idx) => (
            <div key={idx}>
              {idx > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <ArrowDown className="w-3 h-3 text-gray-400 mx-auto" />
                </div>
              )}
              <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    {idx === 0 ? 'Start' : `Stop ${idx}`}
                  </span>
                  {idx > 0 && stops.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeStop(idx)}
                      className="text-red-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <ContactAutocomplete
                  value={stop.location}
                  contactType="location"
                  placeholder={idx === 0 ? 'Starting location' : 'Destination'}
                  onChange={(name) => updateStop(idx, 'location', name)}
                  inputClassName="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  showLocations
                />
                {idx > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    <select
                      value={stop.mode}
                      onChange={(e) => updateStop(idx, 'mode', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    >
                      {MODE_OPTIONS.map((m) => (
                        <option key={m} value={m}>{MODE_ICONS[m]} {m}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={stop.distance_miles}
                      onChange={(e) => updateStop(idx, 'distance_miles', e.target.value)}
                      placeholder="Miles"
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    />
                    <input
                      type="number"
                      value={stop.duration_min}
                      onChange={(e) => updateStop(idx, 'duration_min', e.target.value)}
                      placeholder="Min"
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={stop.cost}
                      onChange={(e) => updateStop(idx, 'cost', e.target.value)}
                      placeholder="$ Cost"
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    />
                  </div>
                )}
                {idx > 0 && vehicles.length > 0 && (
                  <select
                    value={stop.vehicle_id}
                    onChange={(e) => {
                      const vid = e.target.value;
                      const v = vehicles.find((veh) => veh.id === vid);
                      const autoMode = v ? (v.trip_mode || VEHICLE_TYPE_TO_MODE[v.type]) : undefined;
                      setStops((s) => s.map((st, i) => i === idx
                        ? { ...st, vehicle_id: vid, ...(autoMode ? { mode: autoMode } : {}) }
                        : st
                      ));
                    }}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                  >
                    <option value="">No vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nickname}{v.ownership_type !== 'owned' ? ` (${v.ownership_type})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addStop}
            className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add stop
          </button>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRoundTrip}
              onChange={(e) => setIsRoundTrip(e.target.checked)}
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-xs font-medium text-gray-600">Round trip (return to start)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveTemplate}
              onChange={(e) => setSaveTemplate(e.target.checked)}
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-xs font-medium text-gray-600">Save as reusable template</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional route notes"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-sky-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Route'}
          </button>
        </div>
      </form>
    </div>
  );
}
