'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Clock, Gauge, Flame, Leaf, DollarSign,
  Copy, Trash2, Loader2, Car, Bike, Footprints, Train, Plane,
  FileText, CheckCircle, Share2,
} from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';
import TripShareModal from '@/components/travel/TripShareModal';

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
  vehicles: { id: string; nickname: string; type: string } | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  planned: { label: 'Planned', className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
};

interface LinkedTransaction {
  id: string;
  amount: number;
  transaction_date: string;
  description: string;
}

const MODE_ICON: Record<string, typeof Car> = {
  car: Car, rideshare: Car, bike: Bike, walk: Footprints, run: Footprints,
  train: Train, bus: Train, plane: Plane, ferry: Train,
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [linkedTx, setLinkedTx] = useState<LinkedTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/travel/trips/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTrip(data.trip || null);
        setLinkedTx(data.linked_transaction || null);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDuplicate = async () => {
    setActionLoading('duplicate');
    try {
      const res = await offlineFetch(`/api/travel/trips/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/travel/trips/${data.id}`);
      }
    } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this trip?')) return;
    setActionLoading('delete');
    try {
      const res = await offlineFetch('/api/travel/trips', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) router.push('/dashboard/travel/trips');
    } finally { setActionLoading(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-sky-600" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Trip not found.</p>
        <Link href="/dashboard/travel/trips" className="text-sky-600 hover:underline mt-2 inline-block">Back to trips</Link>
      </div>
    );
  }

  const ModeIcon = MODE_ICON[trip.mode] || Car;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/travel/trips" className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                <ModeIcon className="w-3 h-3" />
                {trip.mode.charAt(0).toUpperCase() + trip.mode.slice(1)}
              </span>
              {trip.is_round_trip && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Round Trip</span>
              )}
              {trip.trip_status && trip.trip_status !== 'completed' && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[trip.trip_status]?.className ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_BADGE[trip.trip_status]?.label ?? trip.trip_status}
                </span>
              )}
              {trip.trip_category && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {trip.trip_category.charAt(0).toUpperCase() + trip.trip_category.slice(1)}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {trip.origin && trip.destination
                ? `${trip.origin} to ${trip.destination}`
                : trip.purpose || 'Trip'}
            </h1>
            {trip.vehicles && <p className="text-gray-500 text-sm">{trip.vehicles.nickname}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">{fmtDate(trip.date)}</div>
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {trip.distance_miles != null && (
            <div>
              <span className="text-gray-400 text-xs block">Distance</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-gray-400" />
                {trip.distance_miles.toLocaleString()} mi{trip.is_round_trip ? ' (one way)' : ''}
              </span>
            </div>
          )}
          {trip.duration_min != null && (
            <div>
              <span className="text-gray-400 text-xs block">Duration</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {trip.duration_min >= 60 ? `${Math.floor(trip.duration_min / 60)}h ${trip.duration_min % 60}m` : `${trip.duration_min}m`}
              </span>
            </div>
          )}
          {trip.cost != null && trip.cost > 0 && (
            <div>
              <span className="text-gray-400 text-xs block">Cost</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                ${Number(trip.cost).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {trip.origin && (
            <div>
              <span className="text-gray-400 text-xs block">Origin</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {trip.origin}
              </span>
            </div>
          )}
          {trip.destination && (
            <div>
              <span className="text-gray-400 text-xs block">Destination</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {trip.destination}
              </span>
            </div>
          )}
          {trip.purpose && (
            <div>
              <span className="text-gray-400 text-xs block">Purpose</span>
              <span className="text-gray-900 font-medium">{trip.purpose}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {trip.calories_burned != null && trip.calories_burned > 0 && (
            <div>
              <span className="text-gray-400 text-xs block">Calories</span>
              <span className="text-orange-600 font-medium flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                {trip.calories_burned.toLocaleString()} cal
              </span>
            </div>
          )}
          {trip.co2_kg != null && trip.co2_kg > 0 && (
            <div>
              <span className="text-gray-400 text-xs block">CO2 Emissions</span>
              <span className="text-green-700 font-medium flex items-center gap-1">
                <Leaf className="w-3.5 h-3.5" />
                {trip.co2_kg.toFixed(1)} kg
              </span>
            </div>
          )}
          {trip.tax_category && (
            <div>
              <span className="text-gray-400 text-xs block">Tax Category</span>
              <span className="text-gray-900 font-medium">{trip.tax_category}</span>
            </div>
          )}
        </div>

        {/* Budget bar */}
        {trip.budget_amount != null && trip.budget_amount > 0 && (
          <div className="text-sm">
            <span className="text-gray-400 text-xs block mb-1">Budget</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (trip.cost || 0) > trip.budget_amount ? 'bg-red-500' :
                    (trip.cost || 0) > trip.budget_amount * 0.8 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, ((trip.cost || 0) / trip.budget_amount) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-600 whitespace-nowrap">
                ${(trip.cost || 0).toFixed(2)} / ${trip.budget_amount.toFixed(2)}
              </span>
            </div>
            {(trip.cost || 0) > trip.budget_amount && (
              <p className="text-xs text-red-600 mt-0.5">Over by ${((trip.cost || 0) - trip.budget_amount).toFixed(2)}</p>
            )}
          </div>
        )}

        {trip.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{trip.notes}</div>
        )}
      </div>

      {/* Linked Transaction */}
      {linkedTx && (
        <Link
          href={`/dashboard/finance/transactions/${linkedTx.id}`}
          className="block bg-green-50 border border-green-200 rounded-2xl p-4 hover:bg-green-100 transition"
        >
          <h3 className="text-sm font-medium text-green-800 mb-1 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            Linked Transaction
          </h3>
          <p className="text-sm text-green-700">
            {linkedTx.description} — ${Number(linkedTx.amount).toFixed(2)} on {fmtDate(linkedTx.transaction_date)}
          </p>
        </Link>
      )}

      {/* Packing Notes */}
      {trip.packing_notes && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Packing Notes</h3>
          <p className="text-sm text-blue-700 whitespace-pre-wrap">{trip.packing_notes}</p>
        </div>
      )}

      {/* Booking Details */}
      {(trip.confirmation_number || trip.carrier_name || trip.accommodation_name || trip.seat_assignment || trip.pickup_address || trip.booking_url || trip.loyalty_program) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Booking Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {trip.confirmation_number && (
              <div>
                <span className="text-gray-400 text-xs block">Confirmation #</span>
                <span className="text-gray-900 font-medium font-mono">{trip.confirmation_number}</span>
              </div>
            )}
            {trip.booking_reference && (
              <div>
                <span className="text-gray-400 text-xs block">Booking Ref</span>
                <span className="text-gray-900 font-medium font-mono">{trip.booking_reference}</span>
              </div>
            )}
            {trip.carrier_name && (
              <div>
                <span className="text-gray-400 text-xs block">{trip.mode === 'plane' ? 'Airline' : 'Carrier'}</span>
                <span className="text-gray-900 font-medium">{trip.carrier_name}</span>
              </div>
            )}
          </div>
          {/* Flight details */}
          {(trip.seat_assignment || trip.terminal || trip.gate) && (
            <div className="grid grid-cols-3 gap-4 text-sm">
              {trip.seat_assignment && (
                <div>
                  <span className="text-gray-400 text-xs block">Seat</span>
                  <span className="text-gray-900 font-medium">{trip.seat_assignment}</span>
                </div>
              )}
              {trip.terminal && (
                <div>
                  <span className="text-gray-400 text-xs block">Terminal</span>
                  <span className="text-gray-900 font-medium">{trip.terminal}</span>
                </div>
              )}
              {trip.gate && (
                <div>
                  <span className="text-gray-400 text-xs block">Gate</span>
                  <span className="text-gray-900 font-medium">{trip.gate}</span>
                </div>
              )}
            </div>
          )}
          {/* Accommodation */}
          {(trip.accommodation_name || trip.check_in_date) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {trip.accommodation_name && (
                <div>
                  <span className="text-gray-400 text-xs block">Accommodation</span>
                  <span className="text-gray-900 font-medium">{trip.accommodation_name}</span>
                  {trip.room_type && <span className="text-gray-500 text-xs block">{trip.room_type}</span>}
                </div>
              )}
              {trip.check_in_date && (
                <div>
                  <span className="text-gray-400 text-xs block">Check-in</span>
                  <span className="text-gray-900 font-medium">{fmtDate(trip.check_in_date)}</span>
                </div>
              )}
              {trip.check_out_date && (
                <div>
                  <span className="text-gray-400 text-xs block">Check-out</span>
                  <span className="text-gray-900 font-medium">{fmtDate(trip.check_out_date)}</span>
                </div>
              )}
            </div>
          )}
          {trip.accommodation_address && (
            <div className="text-sm">
              <span className="text-gray-400 text-xs block">Address</span>
              <span className="text-gray-900">{trip.accommodation_address}</span>
            </div>
          )}
          {/* Pickup / Return */}
          {(trip.pickup_address || trip.return_address) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {trip.pickup_address && (
                <div>
                  <span className="text-gray-400 text-xs block">Pickup</span>
                  <span className="text-gray-900">{trip.pickup_address}</span>
                  {trip.pickup_time && <span className="text-gray-500 text-xs block">{trip.pickup_time}</span>}
                </div>
              )}
              {trip.return_address && (
                <div>
                  <span className="text-gray-400 text-xs block">Return</span>
                  <span className="text-gray-900">{trip.return_address}</span>
                  {trip.return_time && <span className="text-gray-500 text-xs block">{trip.return_time}</span>}
                </div>
              )}
            </div>
          )}
          {/* Loyalty */}
          {(trip.loyalty_program || trip.loyalty_number) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {trip.loyalty_program && (
                <div>
                  <span className="text-gray-400 text-xs block">Loyalty Program</span>
                  <span className="text-gray-900 font-medium">{trip.loyalty_program}</span>
                </div>
              )}
              {trip.loyalty_number && (
                <div>
                  <span className="text-gray-400 text-xs block">Member #</span>
                  <span className="text-gray-900 font-medium font-mono">{trip.loyalty_number}</span>
                </div>
              )}
            </div>
          )}
          {trip.booking_url && (
            <div className="text-sm">
              <a href={trip.booking_url} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline text-xs">
                View Booking
              </a>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          {trip.trip_status === 'planned' && (
            <button
              onClick={async () => {
                setActionLoading('complete');
                try {
                  await offlineFetch('/api/travel/trips', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: trip.id, trip_status: 'completed' }),
                  });
                  load();
                } finally { setActionLoading(null); }
              }}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 min-h-11 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 disabled:opacity-50 transition"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Mark Completed
            </button>
          )}
          {trip.trip_status === 'planned' && (
            <button
              onClick={async () => {
                setActionLoading('progress');
                try {
                  await offlineFetch('/api/travel/trips', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: trip.id, trip_status: 'in_progress' }),
                  });
                  load();
                } finally { setActionLoading(null); }
              }}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 min-h-11 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 disabled:opacity-50 transition"
            >
              Start Trip
            </button>
          )}
          <a
            href={`/api/travel/trips/${trip.id}/itinerary`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 min-h-11 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
          >
            <FileText className="w-3.5 h-3.5" /> Download Itinerary
          </a>
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3 min-h-11 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
          <button
            onClick={handleDuplicate}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 min-h-11 bg-sky-50 text-sky-700 rounded-lg text-sm font-medium hover:bg-sky-100 disabled:opacity-50 transition"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button
            onClick={handleDelete}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 min-h-11 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />}
        </div>
      </div>

      {/* Activity Links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <ActivityLinker entityType="trip" entityId={trip.id} />
      </div>

      {/* Life Categories */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <LifeCategoryTagger entityType="trip" entityId={trip.id} />
      </div>

      {/* Share Modal */}
      <TripShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        entityType="trip"
        entityId={trip.id}
      />
    </div>
  );
}
