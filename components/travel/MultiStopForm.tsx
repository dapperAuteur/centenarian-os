'use client';

import { useState } from 'react';
import { Plus, Trash2, ArrowDown, ChevronDown } from 'lucide-react';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Vehicle {
  id: string;
  nickname: string;
  type: string;
  ownership_type: string;
  trip_mode: string | null;
  is_system?: boolean;
}

interface Stop {
  location: string;
  mode: string;
  distance_miles: string;
  duration_min: string;
  cost: string;
  purpose: string;
  vehicle_id: string;
  date: string; // per-leg date for multi-day trips
  calories_burned: string;
  tax_category: string;
  trip_category: string;
  // Booking details
  confirmation_number: string;
  carrier_name: string;
  seat_assignment: string;
  terminal: string;
  gate: string;
  accommodation_name: string;
  accommodation_address: string;
  pickup_address: string;
  return_address: string;
  booking_url: string;
}

const HUMAN_POWERED_MODES = ['bike', 'walk', 'run', 'other'];

const MODE_OPTIONS = ['bike', 'car', 'bus', 'train', 'plane', 'walk', 'run', 'ferry', 'rideshare', 'other'];
const MODE_ICONS: Record<string, string> = {
  bike: '🚲', car: '🚗', bus: '🚌', train: '🚂', plane: '✈️',
  walk: '🚶', run: '🏃', ferry: '⛴️', rideshare: '🚕', other: '🚐',
};

const VEHICLE_TYPE_TO_MODE: Record<string, string> = {
  car: 'car', bike: 'bike', ebike: 'bike',
  motorcycle: 'car', scooter: 'car', shoes: 'walk',
  plane: 'plane', train: 'train', bus: 'bus',
  ferry: 'ferry', rideshare: 'rideshare',
};

const BLANK_STOP: Stop = {
  location: '',
  mode: 'car',
  distance_miles: '',
  duration_min: '',
  cost: '',
  purpose: 'commute',
  vehicle_id: '',
  date: '',
  calories_burned: '',
  tax_category: 'personal',
  trip_category: 'travel',
  confirmation_number: '',
  carrier_name: '',
  seat_assignment: '',
  terminal: '',
  gate: '',
  accommodation_name: '',
  accommodation_address: '',
  pickup_address: '',
  return_address: '',
  booking_url: '',
};

interface TripTemplateStop {
  stop_order: number;
  location_name: string;
  mode: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  cost: number | null;
  purpose: string | null;
  vehicle_id: string | null;
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
  purpose: string | null;
  trip_category: string | null;
  tax_category: string | null;
  notes: string | null;
  is_multi_stop: boolean;
  use_count: number;
  stops?: TripTemplateStop[];
}

interface LegData {
  mode: string;
  origin: string | null;
  destination: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  cost: number | null;
  purpose: string | null;
  vehicle_id: string | null;
  date?: string | null;
}

interface MultiStopFormProps {
  vehicles: Vehicle[];
  brands?: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  editRouteId?: string;
  initialRoute?: {
    name: string | null;
    date: string;
    notes: string | null;
    is_round_trip: boolean;
    trip_status?: string;
    end_date?: string | null;
    packing_notes?: string | null;
    budget_amount?: number | null;
    brand_id?: string | null;
    visibility?: string | null;
  };
  initialLegs?: LegData[];
  defaultStatus?: string;
  templates?: TripTemplate[];
}

function legsToStops(legs: LegData[], isRoundTrip: boolean, routeDate?: string): Stop[] {
  if (!legs.length) return [{ ...BLANK_STOP, mode: '', date: routeDate || '' }, { ...BLANK_STOP, date: routeDate || '' }];

  // If round trip and last leg destination === first leg origin, strip the return leg
  let effectiveLegs = legs;
  if (isRoundTrip && legs.length >= 2) {
    const lastLeg = legs[legs.length - 1];
    const firstLeg = legs[0];
    if (lastLeg.destination && firstLeg.origin && lastLeg.destination === firstLeg.origin) {
      effectiveLegs = legs.slice(0, -1);
    }
  }

  const stops: Stop[] = [];
  // Stop 0: origin of first leg (no transport info)
  stops.push({
    ...BLANK_STOP,
    location: effectiveLegs[0].origin || '',
    mode: '',
    date: effectiveLegs[0].date || routeDate || '',
  });
  // Stop i (1..N): destination of leg i-1, with leg i-1's transport info
  for (const leg of effectiveLegs) {
    stops.push({
      ...BLANK_STOP,
      location: leg.destination || '',
      mode: leg.mode || 'car',
      distance_miles: leg.distance_miles != null ? String(leg.distance_miles) : '',
      duration_min: leg.duration_min != null ? String(leg.duration_min) : '',
      cost: leg.cost != null ? String(leg.cost) : '',
      purpose: leg.purpose || 'errand',
      vehicle_id: leg.vehicle_id || '',
      date: leg.date || routeDate || '',
    });
  }
  return stops;
}

export default function MultiStopForm({ vehicles, brands = [], onClose, onSaved, editRouteId, initialRoute, initialLegs, defaultStatus, templates }: MultiStopFormProps) {
  const isEdit = !!editRouteId;
  const [name, setName] = useState(initialRoute?.name || '');
  const [date, setDate] = useState(initialRoute?.date || new Date().toISOString().split('T')[0]);
  const [stops, setStops] = useState<Stop[]>(() =>
    initialLegs?.length
      ? legsToStops(initialLegs, initialRoute?.is_round_trip ?? false, initialRoute?.date)
      : [{ ...BLANK_STOP, mode: '', date: '' }, { ...BLANK_STOP, date: '' }]
  );
  const [isRoundTrip, setIsRoundTrip] = useState(initialRoute?.is_round_trip ?? false);
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [notes, setNotes] = useState(initialRoute?.notes || '');
  const [tripStatus, setTripStatus] = useState(initialRoute?.trip_status || defaultStatus || 'completed');
  const [packingNotes, setPackingNotes] = useState(initialRoute?.packing_notes || '');
  const [budgetAmount, setBudgetAmount] = useState(initialRoute?.budget_amount != null ? String(initialRoute.budget_amount) : '');
  const [brandId, setBrandId] = useState(initialRoute?.brand_id || '');
  const [visibility, setVisibility] = useState(initialRoute?.visibility || 'private');
  const [saving, setSaving] = useState(false);
  const [expandedBooking, setExpandedBooking] = useState<number | null>(null);
  const [expandedExtra, setExpandedExtra] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const isPlanning = tripStatus === 'planned' || tripStatus === 'in_progress';
  const isMultiStop = stops.length > 2;

  const applyTemplate = (tmpl: TripTemplate) => {
    if (tmpl.name) setName(tmpl.name);
    if (tmpl.notes) setNotes(tmpl.notes);
    if (tmpl.is_multi_stop && tmpl.stops?.length) {
      const newStops: Stop[] = tmpl.stops
        .slice()
        .sort((a, b) => a.stop_order - b.stop_order)
        .map((s) => ({
          ...BLANK_STOP,
          location: s.location_name,
          mode: s.mode || '',
          distance_miles: s.distance_miles != null ? String(s.distance_miles) : '',
          duration_min: s.duration_min != null ? String(s.duration_min) : '',
          cost: s.cost != null ? String(s.cost) : '',
          purpose: s.purpose || '',
          vehicle_id: s.vehicle_id || '',
          trip_category: tmpl.trip_category || 'travel',
          tax_category: tmpl.tax_category || 'personal',
          date: '',
        }));
      setStops(newStops);
    } else {
      setStops([
        { ...BLANK_STOP, location: tmpl.origin || '', mode: tmpl.mode || '', vehicle_id: tmpl.vehicle_id || '', date: '' },
        {
          ...BLANK_STOP,
          location: tmpl.destination || '',
          mode: tmpl.mode || '',
          vehicle_id: tmpl.vehicle_id || '',
          distance_miles: tmpl.distance_miles != null ? String(tmpl.distance_miles) : '',
          duration_min: tmpl.duration_min != null ? String(tmpl.duration_min) : '',
          purpose: tmpl.purpose || 'commute',
          trip_category: tmpl.trip_category || 'travel',
          tax_category: tmpl.tax_category || 'personal',
          date: '',
        },
      ]);
    }
  };
  const userVehicles = vehicles.filter((v) => !v.is_system);
  const systemVehicles = vehicles.filter((v) => v.is_system);

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
      let effectiveStops = stops;
      if (isRoundTrip && stops.length >= 2 && stops[stops.length - 1].location !== stops[0].location) {
        // Sum outbound legs for the return leg estimate
        let totalDist = 0;
        let totalDur = 0;
        let totalCost = 0;
        for (let i = 1; i < stops.length; i++) {
          if (stops[i].distance_miles) totalDist += parseFloat(stops[i].distance_miles);
          if (stops[i].duration_min) totalDur += parseInt(stops[i].duration_min);
          if (stops[i].cost) totalCost += parseFloat(stops[i].cost);
        }
        effectiveStops = [...stops, {
          ...BLANK_STOP,
          location: stops[0].location,
          mode: stops[stops.length - 1].mode || 'car',
          distance_miles: totalDist > 0 ? String(totalDist) : '',
          duration_min: totalDur > 0 ? String(totalDur) : '',
          cost: totalCost > 0 ? String(totalCost) : '',
          purpose: stops[stops.length - 1].purpose,
          vehicle_id: stops[stops.length - 1].vehicle_id,
          date: stops[stops.length - 1].date || date,
        }];
      }

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
          date: to.date || null,
          calories_burned: to.calories_burned ? Number(to.calories_burned) : null,
          tax_category: to.tax_category || 'personal',
          trip_category: HUMAN_POWERED_MODES.includes(to.mode) ? (to.trip_category || 'travel') : 'travel',
          confirmation_number: to.confirmation_number || null,
          carrier_name: to.carrier_name || null,
          seat_assignment: to.seat_assignment || null,
          terminal: to.terminal || null,
          gate: to.gate || null,
          accommodation_name: to.accommodation_name || null,
          accommodation_address: to.accommodation_address || null,
          pickup_address: to.pickup_address || null,
          return_address: to.return_address || null,
          booking_url: to.booking_url || null,
        });
      }

      const url = isEdit ? `/api/travel/routes/${editRouteId}` : '/api/travel/routes';
      const method = isEdit ? 'PATCH' : 'POST';
      const payload: Record<string, unknown> = {
        name: name.trim() || null,
        date,
        legs,
        notes: notes.trim() || null,
        is_round_trip: isRoundTrip,
        trip_status: tripStatus,
        packing_notes: packingNotes.trim() || null,
        budget_amount: budgetAmount ? Number(budgetAmount) : null,
        brand_id: brandId || null,
        visibility: visibility || 'private',
      };
      if (!isEdit) {
        payload.save_as_template = saveTemplate && name.trim();
      }

      const res = await offlineFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        className="bg-white rounded-2xl p-6 pb-0 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-gray-900">
          {isEdit ? (isMultiStop ? 'Edit Route' : 'Edit Trip')
            : isPlanning ? (isMultiStop ? 'Plan Multi-Stop Trip' : 'Plan Trip')
            : isMultiStop ? 'Multi-Stop Route' : 'Add Trip'}
        </h2>

        {!isEdit && templates && templates.length > 0 && (
          <div>
            <label htmlFor="template-select" className="block text-xs font-medium text-gray-600 mb-1">Load from template</label>
            <select
              id="template-select"
              value={selectedTemplateId}
              onChange={(e) => {
                const tmpl = templates.find((t) => t.id === e.target.value);
                setSelectedTemplateId(e.target.value);
                if (tmpl) applyTemplate(tmpl);
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="">— choose a template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.distance_miles ? ` (${t.distance_miles} mi)` : ''}{t.use_count > 0 ? ` · ${t.use_count}x` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status selector */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['planned', 'in_progress', 'completed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTripStatus(s)}
                className={`flex-1 py-2 font-medium transition capitalize min-h-11 ${tripStatus === s
                  ? s === 'planned' ? 'bg-blue-600 text-white'
                    : s === 'in_progress' ? 'bg-amber-500 text-white'
                    : 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
                }`}
                aria-pressed={tripStatus === s}
              >
                {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="route-name" className="block text-xs font-medium text-gray-600 mb-1">{isMultiStop ? 'Route Name' : 'Trip Name'}</label>
            <input
              id="route-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Errands"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="route-date" className="block text-xs font-medium text-gray-600 mb-1">{isPlanning ? 'Start Date' : 'Date'}</label>
            <input
              id="route-date"
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select
                      value={stop.mode}
                      onChange={(e) => updateStop(idx, 'mode', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs min-h-11"
                      aria-label={`Mode for leg ${idx}`}
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
                {idx > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {vehicles.length > 0 && (
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
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs min-h-11"
                        aria-label={`Vehicle for leg ${idx}`}
                      >
                        <option value="">No vehicle</option>
                        {userVehicles.length > 0 && (
                          <optgroup label="Your Vehicles">
                            {userVehicles.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.nickname}{v.ownership_type !== 'owned' ? ` (${v.ownership_type})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {systemVehicles.length > 0 && (
                          <optgroup label="Public Transport">
                            {systemVehicles.map((v) => (
                              <option key={v.id} value={v.id}>{v.nickname}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    )}
                    <input
                      type="date"
                      value={stop.date || date}
                      onChange={(e) => updateStop(idx, 'date', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs min-h-11"
                      aria-label={`Date for leg ${idx}`}
                    />
                  </div>
                )}
                {/* Per-leg extra fields (calories, tax, trip type) */}
                {idx > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedExtra(expandedExtra === idx ? null : idx)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-medium text-gray-500 hover:bg-gray-50 transition"
                    >
                      <span>Purpose &amp; Details</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${expandedExtra === idx ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedExtra === idx && (
                      <div className="px-2 pb-2 space-y-2 border-t border-gray-100">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                          <select
                            value={stop.purpose}
                            onChange={(e) => updateStop(idx, 'purpose', e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                            aria-label="Purpose"
                          >
                            {['commute', 'leisure', 'work', 'errand', 'exercise', 'other'].map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          <select
                            value={stop.tax_category}
                            onChange={(e) => updateStop(idx, 'tax_category', e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                            aria-label="Tax category"
                          >
                            <option value="personal">Personal</option>
                            <option value="business">Business</option>
                            <option value="medical">Medical</option>
                            <option value="charitable">Charitable</option>
                          </select>
                          <input
                            type="number"
                            value={stop.calories_burned}
                            onChange={(e) => updateStop(idx, 'calories_burned', e.target.value)}
                            placeholder="Calories"
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                            aria-label="Calories burned"
                          />
                        </div>
                        {HUMAN_POWERED_MODES.includes(stop.mode) && (
                          <div>
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                              <button
                                type="button"
                                onClick={() => updateStop(idx, 'trip_category', 'travel')}
                                className={`flex-1 py-1.5 font-medium transition ${stop.trip_category === 'travel' ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                              >
                                Travel
                              </button>
                              <button
                                type="button"
                                onClick={() => updateStop(idx, 'trip_category', 'fitness')}
                                className={`flex-1 py-1.5 font-medium transition ${stop.trip_category === 'fitness' ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                              >
                                Fitness
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {idx > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedBooking(expandedBooking === idx ? null : idx)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-medium text-gray-500 hover:bg-gray-50 transition"
                    >
                      <span>Booking Details</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${expandedBooking === idx ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedBooking === idx && (
                      <div className="px-2 pb-2 space-y-2 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input type="text" value={stop.confirmation_number} placeholder="Confirmation #"
                            onChange={(e) => updateStop(idx, 'confirmation_number', e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Confirmation number" />
                          <input type="text" value={stop.carrier_name}
                            placeholder={stop.mode === 'plane' ? 'Airline' : 'Carrier'}
                            onChange={(e) => updateStop(idx, 'carrier_name', e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Carrier name" />
                        </div>
                        {stop.mode === 'plane' && (
                          <div className="grid grid-cols-3 gap-2">
                            <input type="text" value={stop.seat_assignment} placeholder="Seat"
                              onChange={(e) => updateStop(idx, 'seat_assignment', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Seat" />
                            <input type="text" value={stop.terminal} placeholder="Terminal"
                              onChange={(e) => updateStop(idx, 'terminal', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Terminal" />
                            <input type="text" value={stop.gate} placeholder="Gate"
                              onChange={(e) => updateStop(idx, 'gate', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Gate" />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={stop.accommodation_name} placeholder="Hotel / Accommodation"
                            onChange={(e) => updateStop(idx, 'accommodation_name', e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Accommodation" />
                          <input type="text" value={stop.accommodation_address} placeholder="Address"
                            onChange={(e) => updateStop(idx, 'accommodation_address', e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Accommodation address" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={stop.pickup_address} placeholder="Pickup address"
                            onChange={(e) => updateStop(idx, 'pickup_address', e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Pickup address" />
                          <input type="text" value={stop.return_address} placeholder="Return address"
                            onChange={(e) => updateStop(idx, 'return_address', e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Return address" />
                        </div>
                        <input type="url" value={stop.booking_url} placeholder="Booking URL"
                          onChange={(e) => updateStop(idx, 'booking_url', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" aria-label="Booking URL" />
                      </div>
                    )}
                  </div>
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
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRoundTrip}
                onChange={(e) => setIsRoundTrip(e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-xs font-medium text-gray-600">Round trip (return to start)</span>
            </label>
            {isRoundTrip && stops.length >= 2 && (() => {
              let d = 0, t = 0, c = 0;
              for (let i = 1; i < stops.length; i++) {
                if (stops[i].distance_miles) d += parseFloat(stops[i].distance_miles);
                if (stops[i].duration_min) t += parseInt(stops[i].duration_min);
                if (stops[i].cost) c += parseFloat(stops[i].cost);
              }
              if (!d && !t && !c) return null;
              return (
                <p className="text-xs text-sky-600 mt-1 ml-6">
                  Return leg auto-added:{' '}
                  {d > 0 && <span>{d.toFixed(1)} mi</span>}
                  {d > 0 && t > 0 && <span> &middot; </span>}
                  {t > 0 && <span>{t} min</span>}
                  {(d > 0 || t > 0) && c > 0 && <span> &middot; </span>}
                  {c > 0 && <span>${c.toFixed(2)}</span>}
                </p>
              );
            })()}
          </div>
          {!isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveTemplate}
                onChange={(e) => setSaveTemplate(e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-xs font-medium text-gray-600">Save as reusable template</span>
            </label>
          )}
        </div>

        <div>
          <label htmlFor="route-notes" className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input
            id="route-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional route notes"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Budget, Brand, Visibility */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="route-budget" className="block text-xs font-medium text-gray-600 mb-1">Budget</label>
            <input
              id="route-budget"
              type="number"
              step="0.01"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              placeholder="$ 0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {brands.length > 0 && (
            <div>
              <label htmlFor="route-brand" className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
              <select
                id="route-brand"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="route-visibility" className="block text-xs font-medium text-gray-600 mb-1">Visibility</label>
            <select
              id="route-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="private">Private</option>
              <option value="shared">Shared</option>
              <option value="public">Public</option>
            </select>
          </div>
        </div>

        {/* Packing notes for planned trips */}
        {isPlanning && (
          <div>
            <label htmlFor="route-packing" className="block text-xs font-medium text-gray-600 mb-1">Packing Notes</label>
            <textarea
              id="route-packing"
              value={packingNotes}
              onChange={(e) => setPackingNotes(e.target.value)}
              placeholder="Items to pack, things to remember..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="sticky bottom-0 bg-white pt-3 pb-3 -mx-6 px-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl min-h-11 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`flex-1 text-white rounded-xl min-h-11 text-sm font-medium transition disabled:opacity-50 ${isPlanning ? 'bg-blue-600 hover:bg-blue-700' : 'bg-sky-600 hover:bg-sky-700'}`}
          >
            {saving ? 'Saving...' : isEdit ? (isMultiStop ? 'Update Route' : 'Update Trip') : isPlanning ? (isMultiStop ? 'Plan Route' : 'Plan Trip') : (isMultiStop ? 'Save Route' : 'Save Trip')}
          </button>
        </div>
      </form>
    </div>
  );
}
