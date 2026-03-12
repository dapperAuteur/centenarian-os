'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const MODE_EMOJI: Record<string, string> = {
  bike: '\u{1F6B2}', car: '\u{1F697}', bus: '\u{1F68C}', train: '\u{1F682}', plane: '\u2708\uFE0F',
  walk: '\u{1F6B6}', run: '\u{1F3C3}', ferry: '\u26F4\uFE0F', rideshare: '\u{1F695}', other: '\u{1F690}',
};

interface Trip {
  mode: string;
  origin: string | null;
  destination: string | null;
  date: string | null;
  end_date: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  cost: number | null;
  co2_kg: number | null;
  notes: string | null;
  confirmation_number: string | null;
  carrier_name: string | null;
  seat_assignment: string | null;
  terminal: string | null;
  gate: string | null;
  accommodation_name: string | null;
  accommodation_address: string | null;
  room_type: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  pickup_address: string | null;
  pickup_time: string | null;
  return_address: string | null;
  return_time: string | null;
  vehicles?: { nickname: string; type: string } | null;
}

interface SharedData {
  title: string;
  date_range: string;
  trips: Trip[];
  packing_notes: string | null;
  equipment_items: { name: string; relationship: string | null }[];
  budget: number | null;
  total_cost: number | null;
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function SharedTripPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/travel/shared/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm" role="status" aria-label="Loading...">
          Loading itinerary...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            This shared trip is no longer available
          </h1>
          <p className="text-sm text-gray-500">
            The share link may have expired or been revoked by the owner.
          </p>
        </div>
      </div>
    );
  }

  const { trips, equipment_items, packing_notes, budget, total_cost } = data;
  const hasBooking = (t: Trip) =>
    t.confirmation_number || t.carrier_name || t.seat_assignment ||
    t.accommodation_name || t.pickup_address;

  const totalMiles = trips.reduce((s, t) => s + (Number(t.distance_miles) || 0), 0);
  const totalMin = trips.reduce((s, t) => s + (Number(t.duration_min) || 0), 0);
  const totalCost = total_cost ?? trips.reduce((s, t) => s + (Number(t.cost) || 0), 0);
  const totalCo2 = trips.reduce((s, t) => s + (Number(t.co2_kg) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            {data.title}
          </h1>
          <p className="text-sm text-gray-500">{data.date_range}</p>
        </header>

        {/* Totals summary (multi-stop) */}
        {trips.length > 1 && (totalMiles > 0 || totalMin > 0 || totalCost > 0) && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Trip Totals</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {totalMiles > 0 && (
                <div>
                  <p className="text-lg font-bold text-gray-900">{totalMiles.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">miles</p>
                </div>
              )}
              {totalMin > 0 && (
                <div>
                  <p className="text-lg font-bold text-gray-900">{totalMin}</p>
                  <p className="text-xs text-gray-500">minutes</p>
                </div>
              )}
              {totalCost > 0 && (
                <div>
                  <p className="text-lg font-bold text-gray-900">${totalCost.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">estimated cost</p>
                </div>
              )}
              {totalCo2 > 0 && (
                <div>
                  <p className="text-lg font-bold text-gray-900">{totalCo2.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">kg CO2</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Budget bar */}
        {budget && budget > 0 && totalCost > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-gray-700">Budget</span>
              <span className="text-gray-500">
                ${totalCost.toFixed(2)} / ${budget.toFixed(2)}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  totalCost > budget ? 'bg-red-500' : 'bg-sky-500'
                }`}
                style={{ width: `${Math.min((totalCost / budget) * 100, 100)}%` }}
              />
            </div>
            {totalCost > budget && (
              <p className="text-xs text-red-500 mt-1">
                Over budget by ${(totalCost - budget).toFixed(2)}
              </p>
            )}
          </div>
        )}

        {/* Legs / itinerary */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
            Itinerary
          </h2>
          <div className="space-y-3">
            {trips.map((trip, i) => {
              const mode = trip.mode || 'other';
              const emoji = MODE_EMOJI[mode] || MODE_EMOJI.other;
              const showDate = trips.length > 1 && trip.date;

              return (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  {showDate && (
                    <p className="text-xs font-semibold text-sky-600 mb-2">
                      {fmtDate(trip.date!)}
                    </p>
                  )}

                  {/* Leg header */}
                  <div className="flex items-center gap-2 mb-2">
                    {trips.length > 1 && (
                      <span className="text-xs font-semibold text-gray-400 uppercase">
                        Leg {i + 1}
                      </span>
                    )}
                    <span className="text-sm font-semibold capitalize">
                      {emoji} {mode}
                    </span>
                    {trip.vehicles?.nickname && (
                      <span className="text-xs text-gray-500">
                        {trip.vehicles.nickname}
                      </span>
                    )}
                  </div>

                  {/* Route */}
                  <p className="text-base mb-2">
                    <span className="font-semibold text-gray-900">
                      {trip.origin || '?'}
                    </span>
                    <span className="text-gray-400 mx-2">&rarr;</span>
                    <span className="font-semibold text-gray-900">
                      {trip.destination || '?'}
                    </span>
                  </p>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {trip.distance_miles && (
                      <span>{Number(trip.distance_miles).toFixed(1)} mi</span>
                    )}
                    {trip.duration_min && <span>{trip.duration_min} min</span>}
                    {trip.cost && <span>${Number(trip.cost).toFixed(2)}</span>}
                    {trip.co2_kg && (
                      <span>{Number(trip.co2_kg).toFixed(1)} kg CO2</span>
                    )}
                  </div>

                  {/* Notes */}
                  {trip.notes && (
                    <p className="text-xs text-gray-400 italic mt-2">{trip.notes}</p>
                  )}

                  {/* Booking details */}
                  {hasBooking(trip) && (
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-200 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {trip.confirmation_number && (
                        <span>
                          <strong className="text-gray-700">Conf #</strong>{' '}
                          {trip.confirmation_number}
                        </span>
                      )}
                      {trip.carrier_name && (
                        <span>
                          <strong className="text-gray-700">Carrier:</strong>{' '}
                          {trip.carrier_name}
                        </span>
                      )}
                      {trip.seat_assignment && (
                        <span>
                          <strong className="text-gray-700">Seat:</strong>{' '}
                          {trip.seat_assignment}
                        </span>
                      )}
                      {trip.terminal && (
                        <span>
                          <strong className="text-gray-700">Terminal:</strong>{' '}
                          {trip.terminal}
                        </span>
                      )}
                      {trip.gate && (
                        <span>
                          <strong className="text-gray-700">Gate:</strong> {trip.gate}
                        </span>
                      )}
                      {trip.accommodation_name && (
                        <span>
                          <strong className="text-gray-700">Hotel:</strong>{' '}
                          {trip.accommodation_name}
                          {trip.room_type ? ` (${trip.room_type})` : ''}
                        </span>
                      )}
                      {trip.accommodation_address && (
                        <span>{trip.accommodation_address}</span>
                      )}
                      {trip.check_in_date && (
                        <span>
                          <strong className="text-gray-700">Check-in:</strong>{' '}
                          {fmtDate(trip.check_in_date)}
                        </span>
                      )}
                      {trip.check_out_date && (
                        <span>
                          <strong className="text-gray-700">Check-out:</strong>{' '}
                          {fmtDate(trip.check_out_date)}
                        </span>
                      )}
                      {trip.pickup_address && (
                        <span>
                          <strong className="text-gray-700">Pickup:</strong>{' '}
                          {trip.pickup_address}
                          {trip.pickup_time ? ` at ${trip.pickup_time}` : ''}
                        </span>
                      )}
                      {trip.return_address && (
                        <span>
                          <strong className="text-gray-700">Return:</strong>{' '}
                          {trip.return_address}
                          {trip.return_time ? ` at ${trip.return_time}` : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Packing list */}
        {(packing_notes || (equipment_items && equipment_items.length > 0)) && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
              Packing List
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              {packing_notes && (
                <p className="text-sm text-gray-700 mb-3 whitespace-pre-line">
                  {packing_notes}
                </p>
              )}
              {equipment_items && equipment_items.length > 0 && (
                <ul role="list" className="space-y-2">
                  {equipment_items.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm text-gray-700 py-1 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-base">&#9744;</span>
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
        <footer className="text-center pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Shared via CentenarianOS &nbsp;&middot;&nbsp; Powered by{' '}
            <a href="https://witus.online" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">
              WitUS.online
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
