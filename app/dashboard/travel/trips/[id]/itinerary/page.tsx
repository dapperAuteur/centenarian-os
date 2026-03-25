'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Printer, Download, Share2, Loader2, Eye, EyeOff,
  Plane, Car, Bike, Footprints, Train, MapPin,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import TripShareModal from '@/components/travel/TripShareModal';

/* ─── types ──────────────────────────────────────────────────────────────── */

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
  route_id: string | null;
  leg_order: number | null;
  vehicles: { id: string; nickname: string; type: string } | null;
}

interface Route {
  id: string;
  name: string | null;
  date: string;
  end_date: string | null;
  notes: string | null;
  packing_notes: string | null;
  is_round_trip: boolean;
  trip_status: string;
  budget_amount: number | null;
}

interface EquipmentItem {
  name: string;
  relationship: string | null;
}

export interface ItinerarySections {
  transport: boolean;
  booking: boolean;
  accommodation: boolean;
  pickupReturn: boolean;
  budget: boolean;
  notes: boolean;
  packing: boolean;
  loyalty: boolean;
  stats: boolean;
}

const DEFAULT_SECTIONS: ItinerarySections = {
  transport: true,
  booking: true,
  accommodation: true,
  pickupReturn: true,
  budget: true,
  notes: true,
  packing: true,
  loyalty: true,
  stats: true,
};

const SECTION_LABELS: Record<keyof ItinerarySections, string> = {
  transport: 'Transport Details',
  booking: 'Booking Details',
  accommodation: 'Accommodation',
  pickupReturn: 'Pickup / Return',
  budget: 'Budget & Costs',
  notes: 'Notes',
  packing: 'Packing List',
  loyalty: 'Loyalty Info',
  stats: 'Distance & Stats',
};

const MODE_ICON: Record<string, typeof Car> = {
  car: Car, rideshare: Car, bike: Bike, walk: Footprints, run: Footprints,
  train: Train, bus: Train, plane: Plane, ferry: Train,
};

const MODE_EMOJI: Record<string, string> = {
  bike: '\u{1F6B2}', car: '\u{1F697}', bus: '\u{1F68C}', train: '\u{1F682}', plane: '\u2708\uFE0F',
  walk: '\u{1F6B6}', run: '\u{1F3C3}', ferry: '\u26F4\uFE0F', rideshare: '\u{1F695}', other: '\u{1F690}',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtTime(t: string | null) {
  if (!t) return '';
  return t;
}

/* ─── helpers to check if a section has data ─────────────────────────────── */

function hasBookingData(t: Trip) {
  return !!(t.confirmation_number || t.booking_reference || t.seat_assignment || t.terminal || t.gate || t.booking_url);
}

function hasAccommodationData(t: Trip) {
  return !!(t.accommodation_name || t.accommodation_address || t.room_type || t.check_in_date || t.check_out_date);
}

function hasPickupReturnData(t: Trip) {
  return !!(t.pickup_address || t.pickup_time || t.return_address || t.return_time);
}

function hasLoyaltyData(t: Trip) {
  return !!(t.loyalty_program || t.loyalty_number);
}

/* ─── component ──────────────────────────────────────────────────────────── */

export default function ItineraryPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<ItinerarySections>({ ...DEFAULT_SECTIONS });
  const [showShareModal, setShowShareModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try as route first
      const routeRes = await offlineFetch(`/api/travel/routes/${id}`);
      if (routeRes.ok) {
        const routeData = await routeRes.json();
        setRoute(routeData.route || routeData);
        setTrips(routeData.legs || routeData.trips || []);
        setEquipmentItems(routeData.equipment_items || []);
        setLoading(false);
        return;
      }

      // Fall back to single trip
      const tripRes = await offlineFetch(`/api/travel/trips/${id}`);
      if (tripRes.ok) {
        const tripData = await tripRes.json();
        const trip = tripData.trip || tripData;
        setTrips([trip]);
        setRoute(null);
      }

      // Fetch equipment links
      const eqRes = await offlineFetch(`/api/activity-links?source_type=trip&source_id=${id}&target_type=equipment`);
      if (eqRes.ok) {
        const eqData = await eqRes.json();
        setEquipmentItems((eqData.links || []).map((l: { target_name?: string; relationship?: string }) => ({
          name: l.target_name || 'Unknown',
          relationship: l.relationship || null,
        })));
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggle = (key: keyof ItinerarySections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /* ─── derived ────────────────────────────────────────────────────────── */

  const isRoute = !!route;
  const title = route?.name || (trips[0]?.origin && trips[0]?.destination
    ? `${trips[0].origin} → ${trips[0].destination}`
    : 'Trip Itinerary');
  const dateStr = route?.date || trips[0]?.date || '';
  const endDateStr = route?.end_date || trips[0]?.end_date || null;
  const packingNotes = route?.packing_notes || trips[0]?.packing_notes || '';
  const budgetAmount = route?.budget_amount || trips[0]?.budget_amount || null;
  const isRoundTrip = route?.is_round_trip || trips[0]?.is_round_trip || false;
  const tripStatus = route?.trip_status || trips[0]?.trip_status || 'planned';

  const totalMiles = trips.reduce((s, t) => s + (Number(t.distance_miles) || 0), 0);
  const totalMin = trips.reduce((s, t) => s + (Number(t.duration_min) || 0), 0);
  const totalCost = trips.reduce((s, t) => s + (Number(t.cost) || 0), 0);
  const totalCo2 = trips.reduce((s, t) => s + (Number(t.co2_kg) || 0), 0);
  const totalCalories = trips.reduce((s, t) => s + (Number(t.calories_burned) || 0), 0);

  const displayMiles = isRoundTrip ? totalMiles * 2 : totalMiles;

  /* ─── PDF export ─────────────────────────────────────────────────────── */

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let y = 20;

      // Title
      doc.setFontSize(18);
      doc.text(title, 14, y); y += 8;
      doc.setFontSize(10);
      doc.setTextColor(100);
      const dateLabel = endDateStr && endDateStr !== dateStr
        ? `${fmtDate(dateStr)} – ${fmtDate(endDateStr)}`
        : fmtDate(dateStr);
      doc.text(dateLabel, 14, y); y += 4;
      if (isRoundTrip) { doc.text('Round Trip', 14, y); y += 4; }
      y += 6;

      // Stats
      if (sections.stats && (totalMiles > 0 || totalMin > 0 || totalCo2 > 0 || totalCalories > 0)) {
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.text('Trip Summary', 14, y); y += 7;
        doc.setFontSize(10);
        if (displayMiles > 0) { doc.text(`Distance: ${displayMiles.toFixed(1)} miles`, 14, y); y += 5; }
        if (totalMin > 0) { doc.text(`Duration: ${totalMin} minutes`, 14, y); y += 5; }
        if (totalCo2 > 0) { doc.text(`CO2: ${totalCo2.toFixed(1)} kg`, 14, y); y += 5; }
        if (totalCalories > 0) { doc.text(`Calories: ${totalCalories}`, 14, y); y += 5; }
        y += 5;
      }

      // Budget
      if (sections.budget && (totalCost > 0 || budgetAmount)) {
        doc.setFontSize(12);
        doc.text('Budget & Costs', 14, y); y += 7;
        doc.setFontSize(10);
        if (totalCost > 0) { doc.text(`Total Cost: $${totalCost.toFixed(2)}`, 14, y); y += 5; }
        if (budgetAmount) { doc.text(`Budget: $${budgetAmount.toFixed(2)}`, 14, y); y += 5; }
        y += 5;
      }

      // Legs
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Itinerary', 14, y); y += 7;

      for (let i = 0; i < trips.length; i++) {
        const t = trips[i];
        if (y > 250) { doc.addPage(); y = 20; }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const legLabel = trips.length > 1 ? `Leg ${i + 1}: ` : '';
        doc.text(`${legLabel}${t.origin || '?'} → ${t.destination || '?'}`, 14, y); y += 5;
        doc.setFont('helvetica', 'normal');

        if (sections.transport) {
          const mode = t.mode || 'other';
          doc.text(`Mode: ${mode}${t.vehicles?.nickname ? ` (${t.vehicles.nickname})` : ''}${t.carrier_name ? ` · ${t.carrier_name}` : ''}`, 14, y);
          y += 5;
        }

        if (trips.length > 1 && t.date) {
          doc.text(`Date: ${fmtDate(t.date)}`, 14, y); y += 5;
        }

        if (sections.booking && hasBookingData(t)) {
          const parts: string[] = [];
          if (t.confirmation_number) parts.push(`Conf: ${t.confirmation_number}`);
          if (t.seat_assignment) parts.push(`Seat: ${t.seat_assignment}`);
          if (t.terminal) parts.push(`Terminal: ${t.terminal}`);
          if (t.gate) parts.push(`Gate: ${t.gate}`);
          doc.text(parts.join(' · '), 14, y); y += 5;
        }

        if (sections.accommodation && hasAccommodationData(t)) {
          if (t.accommodation_name) {
            doc.text(`Hotel: ${t.accommodation_name}${t.room_type ? ` (${t.room_type})` : ''}`, 14, y); y += 5;
          }
          if (t.check_in_date) { doc.text(`Check-in: ${fmtDate(t.check_in_date)}`, 14, y); y += 5; }
          if (t.check_out_date) { doc.text(`Check-out: ${fmtDate(t.check_out_date)}`, 14, y); y += 5; }
        }

        if (sections.pickupReturn && hasPickupReturnData(t)) {
          if (t.pickup_address) { doc.text(`Pickup: ${t.pickup_address}${t.pickup_time ? ` at ${fmtTime(t.pickup_time)}` : ''}`, 14, y); y += 5; }
          if (t.return_address) { doc.text(`Return: ${t.return_address}${t.return_time ? ` at ${fmtTime(t.return_time)}` : ''}`, 14, y); y += 5; }
        }

        if (sections.loyalty && hasLoyaltyData(t)) {
          const parts: string[] = [];
          if (t.loyalty_program) parts.push(t.loyalty_program);
          if (t.loyalty_number) parts.push(`#${t.loyalty_number}`);
          doc.text(`Loyalty: ${parts.join(' ')}`, 14, y); y += 5;
        }

        if (sections.notes && t.notes) {
          doc.setTextColor(100);
          const noteLines = doc.splitTextToSize(t.notes, 180);
          doc.text(noteLines, 14, y);
          y += noteLines.length * 5;
          doc.setTextColor(0);
        }

        y += 6;
      }

      // Packing
      if (sections.packing && (packingNotes || equipmentItems.length > 0)) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.text('Packing List', 14, y); y += 7;
        doc.setFontSize(10);
        if (packingNotes) {
          const lines = doc.splitTextToSize(packingNotes, 180);
          doc.text(lines, 14, y);
          y += lines.length * 5 + 3;
        }
        for (const item of equipmentItems) {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(`☐ ${item.name}${item.relationship ? ` (${item.relationship.replace(/_/g, ' ')})` : ''}`, 14, y);
          y += 5;
        }
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Generated by CentenarianOS', 14, 285);

      doc.save(`${title.replace(/[^a-zA-Z0-9 ]/g, '')}-itinerary.pdf`);
    } finally {
      setExporting(false);
    }
  };

  /* ─── render ─────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-sky-600" aria-label="Loading..." />
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Trip not found.</p>
        <Link href="/dashboard/travel/trips" className="text-sky-600 hover:underline text-sm mt-2 inline-block">
          Back to trips
        </Link>
      </div>
    );
  }

  const statusBadge: Record<string, string> = {
    planned: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  const ModeIcon = MODE_ICON[trips[0]?.mode] || MapPin;

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">

        {/* Back + Actions bar (hidden in print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 print:hidden">
          <button
            onClick={() => router.back()}
            className="min-h-11 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="min-h-11 flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-500 transition"
              aria-label="Print or save as PDF"
            >
              <Printer className="w-4 h-4" aria-hidden="true" /> Print
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="min-h-11 flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              aria-label="Export as PDF file"
            >
              <Download className="w-4 h-4" aria-hidden="true" /> {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="min-h-11 flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              aria-label="Share itinerary"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" /> Share
            </button>
          </div>
        </div>

        {/* Section toggles (hidden in print) */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 print:hidden">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Include in itinerary</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(SECTION_LABELS) as (keyof ItinerarySections)[]).map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 min-h-11 px-2 rounded-lg hover:bg-gray-100 transition"
              >
                <input
                  type="checkbox"
                  checked={sections[key]}
                  onChange={() => toggle(key)}
                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="flex items-center gap-1.5">
                  {sections[key] ? <Eye className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />}
                  {SECTION_LABELS[key]}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* ─── Printable itinerary content ─────────────────────────────── */}
        <div id="itinerary-content">
          {/* Header */}
          <header className="mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-start gap-3">
              <ModeIcon className="w-6 h-6 text-sky-600 mt-1 shrink-0 print:hidden" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                  <span>{fmtDate(dateStr)}</span>
                  {endDateStr && endDateStr !== dateStr && (
                    <span>– {fmtDate(endDateStr)}</span>
                  )}
                  {isRoundTrip && <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-xs font-medium">Round Trip</span>}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusBadge[tripStatus] || 'bg-gray-100 text-gray-500'}`}>
                    {tripStatus.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Stats summary */}
          {sections.stats && (displayMiles > 0 || totalMin > 0 || totalCo2 > 0 || totalCalories > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {displayMiles > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-900">{displayMiles.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">miles</p>
                </div>
              )}
              {totalMin > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-900">{totalMin < 60 ? `${totalMin}m` : `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`}</p>
                  <p className="text-xs text-gray-500">duration</p>
                </div>
              )}
              {totalCo2 > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-900">{totalCo2.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">kg CO₂</p>
                </div>
              )}
              {totalCalories > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-900">{totalCalories}</p>
                  <p className="text-xs text-gray-500">calories</p>
                </div>
              )}
            </div>
          )}

          {/* Budget bar */}
          {sections.budget && (totalCost > 0 || (budgetAmount && budgetAmount > 0)) && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-gray-700">Budget</span>
                <span className="text-gray-500">
                  ${totalCost.toFixed(2)}{budgetAmount ? ` / $${budgetAmount.toFixed(2)}` : ''}
                </span>
              </div>
              {budgetAmount && budgetAmount > 0 && (
                <>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${totalCost > budgetAmount ? 'bg-red-500' : 'bg-sky-500'}`}
                      style={{ width: `${Math.min((totalCost / budgetAmount) * 100, 100)}%` }}
                    />
                  </div>
                  {totalCost > budgetAmount && (
                    <p className="text-xs text-red-500 mt-1">Over budget by ${(totalCost - budgetAmount).toFixed(2)}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Itinerary legs */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Itinerary</h2>
            <div className="space-y-3">
              {trips.map((trip, i) => {
                const mode = trip.mode || 'other';
                const emoji = MODE_EMOJI[mode] || MODE_EMOJI.other;
                const showLegDate = trips.length > 1 && trip.date;

                return (
                  <div key={trip.id || i} className="bg-white border border-gray-200 rounded-xl p-4">
                    {showLegDate && (
                      <p className="text-xs font-semibold text-sky-600 mb-2">{fmtDate(trip.date)}</p>
                    )}

                    {/* Leg header */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {trips.length > 1 && (
                        <span className="text-xs font-semibold text-gray-400 uppercase">Leg {i + 1}</span>
                      )}
                      {sections.transport && (
                        <span className="text-sm font-semibold capitalize">{emoji} {mode}</span>
                      )}
                      {sections.transport && trip.vehicles?.nickname && (
                        <span className="text-xs text-gray-500">{trip.vehicles.nickname}</span>
                      )}
                      {sections.transport && trip.carrier_name && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{trip.carrier_name}</span>
                      )}
                    </div>

                    {/* Route */}
                    <p className="text-base mb-2">
                      <span className="font-semibold text-gray-900">{trip.origin || '?'}</span>
                      <span className="text-gray-400 mx-2">→</span>
                      <span className="font-semibold text-gray-900">{trip.destination || '?'}</span>
                    </p>

                    {/* Per-leg stats */}
                    {sections.stats && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                        {trip.distance_miles && <span>{Number(trip.distance_miles).toFixed(1)} mi{trip.is_round_trip ? ' (one way)' : ''}</span>}
                        {trip.duration_min && <span>{trip.duration_min} min</span>}
                        {sections.budget && trip.cost && <span>${Number(trip.cost).toFixed(2)}</span>}
                        {trip.co2_kg && <span>{Number(trip.co2_kg).toFixed(1)} kg CO₂</span>}
                      </div>
                    )}

                    {/* Booking details */}
                    {sections.booking && hasBookingData(trip) && (
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Booking</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                          {trip.confirmation_number && <span><strong>Conf #</strong> {trip.confirmation_number}</span>}
                          {trip.booking_reference && <span><strong>Ref:</strong> {trip.booking_reference}</span>}
                          {trip.seat_assignment && <span><strong>Seat:</strong> {trip.seat_assignment}</span>}
                          {trip.terminal && <span><strong>Terminal:</strong> {trip.terminal}</span>}
                          {trip.gate && <span><strong>Gate:</strong> {trip.gate}</span>}
                          {trip.booking_url && (
                            <a href={trip.booking_url} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline print:text-gray-600">
                              View Booking
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Accommodation */}
                    {sections.accommodation && hasAccommodationData(trip) && (
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Accommodation</p>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {trip.accommodation_name && (
                            <p className="font-medium text-gray-800">
                              {trip.accommodation_name}{trip.room_type ? ` — ${trip.room_type}` : ''}
                            </p>
                          )}
                          {trip.accommodation_address && <p>{trip.accommodation_address}</p>}
                          <div className="flex flex-wrap gap-x-4">
                            {trip.check_in_date && <span><strong>Check-in:</strong> {fmtDate(trip.check_in_date)}</span>}
                            {trip.check_out_date && <span><strong>Check-out:</strong> {fmtDate(trip.check_out_date)}</span>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Pickup / Return */}
                    {sections.pickupReturn && hasPickupReturnData(trip) && (
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Pickup / Return</p>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {trip.pickup_address && <p><strong>Pickup:</strong> {trip.pickup_address}{trip.pickup_time ? ` at ${fmtTime(trip.pickup_time)}` : ''}</p>}
                          {trip.return_address && <p><strong>Return:</strong> {trip.return_address}{trip.return_time ? ` at ${fmtTime(trip.return_time)}` : ''}</p>}
                        </div>
                      </div>
                    )}

                    {/* Loyalty */}
                    {sections.loyalty && hasLoyaltyData(trip) && (
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Loyalty</p>
                        <p className="text-xs text-gray-600">
                          {trip.loyalty_program}{trip.loyalty_number ? ` — #${trip.loyalty_number}` : ''}
                        </p>
                      </div>
                    )}

                    {/* Notes */}
                    {sections.notes && trip.notes && (
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                        <p className="text-xs text-gray-500 italic whitespace-pre-line">{trip.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Packing list */}
          {sections.packing && (packingNotes || equipmentItems.length > 0) && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Packing List</h2>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                {packingNotes && (
                  <p className="text-sm text-gray-700 mb-3 whitespace-pre-line">{packingNotes}</p>
                )}
                {equipmentItems.length > 0 && (
                  <ul role="list" className="space-y-1">
                    {equipmentItems.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700 py-1 border-b border-gray-100 last:border-0">
                        <span className="text-base">☐</span>
                        <span>{item.name}</span>
                        {item.relationship && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded capitalize">
                            {item.relationship.replace(/_/g, ' ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="text-center pt-4 border-t border-gray-200 text-xs text-gray-400">
            Generated by CentenarianOS
          </footer>
        </div>
      </div>

      {/* Share modal */}
      <TripShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        entityType={isRoute ? 'route' : 'trip'}
        entityId={id}
        includedSections={sections as unknown as { [key: string]: boolean }}
      />

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden, [class*="print:hidden"] { display: none !important; }
          body { background: white !important; }
          #itinerary-content { max-width: 100% !important; }
        }
      `}</style>
    </>
  );
}
