import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODE_EMOJI: Record<string, string> = {
  bike: '\u{1F6B2}', car: '\u{1F697}', bus: '\u{1F68C}', train: '\u{1F682}', plane: '\u2708\uFE0F',
  walk: '\u{1F6B6}', run: '\u{1F3C3}', ferry: '\u26F4\uFE0F', rideshare: '\u{1F695}', other: '\u{1F690}',
};

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

/**
 * GET /api/travel/trips/[id]/itinerary
 * Returns a standalone HTML itinerary page (printable / saveable as PDF).
 * Also supports route_id query param for multi-stop routes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if this is a route or a single trip
  const { data: route } = await supabase
    .from('trip_routes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  let trips: Record<string, unknown>[] = [];
  let title = '';
  let dateRange = '';
  let packingNotes = '';

  if (route) {
    // Multi-stop route
    title = route.name || 'Multi-Stop Trip';
    dateRange = fmtDate(route.date);
    if (route.end_date && route.end_date !== route.date) {
      dateRange += ` \u2013 ${fmtDate(route.end_date)}`;
    }
    packingNotes = route.packing_notes || '';

    const { data: legs } = await supabase
      .from('trips')
      .select('*, vehicles(nickname, type)')
      .eq('route_id', id)
      .eq('user_id', user.id)
      .order('leg_order', { ascending: true });
    trips = legs || [];
  } else {
    // Single trip
    const { data: trip } = await supabase
      .from('trips')
      .select('*, vehicles(nickname, type)')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    title = trip.origin && trip.destination
      ? `${trip.origin} \u2192 ${trip.destination}`
      : `${trip.mode} Trip`;
    dateRange = fmtDate(trip.date);
    if (trip.end_date && trip.end_date !== trip.date) {
      dateRange += ` \u2013 ${fmtDate(trip.end_date)}`;
    }
    packingNotes = trip.packing_notes || '';
    trips = [trip];
  }

  // Fetch linked equipment (packing list)
  const { data: equipLinks } = await supabase
    .from('activity_links')
    .select('target_id, relationship, notes')
    .eq('user_id', user.id)
    .eq('source_type', route ? 'route' : 'trip')
    .eq('source_id', id)
    .eq('target_type', 'equipment');

  let equipmentItems: { name: string; relationship: string | null }[] = [];
  if (equipLinks && equipLinks.length > 0) {
    const eqIds = equipLinks.map((l) => l.target_id);
    const { data: eqData } = await supabase
      .from('equipment')
      .select('id, name')
      .in('id', eqIds);

    if (eqData) {
      const eqMap = new Map(eqData.map((e) => [e.id, e.name]));
      equipmentItems = equipLinks.map((l) => ({
        name: eqMap.get(l.target_id) || 'Unknown',
        relationship: l.relationship,
      }));
    }
  }

  // Also check reverse direction (equipment -> trip)
  const { data: reverseLinks } = await supabase
    .from('activity_links')
    .select('source_id, relationship, notes')
    .eq('user_id', user.id)
    .eq('target_type', route ? 'route' : 'trip')
    .eq('target_id', id)
    .eq('source_type', 'equipment');

  if (reverseLinks && reverseLinks.length > 0) {
    const eqIds = reverseLinks.map((l) => l.source_id);
    const { data: eqData } = await supabase
      .from('equipment')
      .select('id, name')
      .in('id', eqIds);

    if (eqData) {
      const eqMap = new Map(eqData.map((e) => [e.id, e.name]));
      for (const l of reverseLinks) {
        equipmentItems.push({
          name: eqMap.get(l.source_id) || 'Unknown',
          relationship: l.relationship,
        });
      }
    }
  }

  // Build HTML
  const legsHtml = trips.map((t, i) => {
    const mode = String(t.mode || 'other');
    const emoji = MODE_EMOJI[mode] || '\u{1F690}';
    const vehicle = t.vehicles as { nickname: string } | null;
    const legDate = String(t.date || '');
    const showDate = trips.length > 1 && legDate;
    return `
      <div class="leg">
        ${showDate ? `<div class="leg-date">${fmtDate(legDate)}</div>` : ''}
        <div class="leg-header">
          <span class="leg-num">${trips.length > 1 ? `Leg ${i + 1}` : 'Trip'}</span>
          <span class="mode">${emoji} ${mode}</span>
          ${vehicle ? `<span class="vehicle">${vehicle.nickname}</span>` : ''}
        </div>
        <div class="leg-route">
          <strong>${t.origin || '?'}</strong> &rarr; <strong>${t.destination || '?'}</strong>
        </div>
        <div class="leg-stats">
          ${t.distance_miles ? `<span>${Number(t.distance_miles).toFixed(1)} mi</span>` : ''}
          ${t.duration_min ? `<span>${t.duration_min} min</span>` : ''}
          ${t.cost ? `<span>$${Number(t.cost).toFixed(2)}</span>` : ''}
          ${t.co2_kg ? `<span>${Number(t.co2_kg).toFixed(1)} kg CO\u2082</span>` : ''}
        </div>
        ${t.notes ? `<div class="leg-notes">${String(t.notes)}</div>` : ''}
        ${(t.confirmation_number || t.carrier_name || t.seat_assignment || t.accommodation_name || t.pickup_address) ? `
        <div class="booking-details">
          ${t.confirmation_number ? `<span class="booking-item"><strong>Conf #</strong> ${t.confirmation_number}</span>` : ''}
          ${t.carrier_name ? `<span class="booking-item"><strong>Carrier:</strong> ${t.carrier_name}</span>` : ''}
          ${t.seat_assignment ? `<span class="booking-item"><strong>Seat:</strong> ${t.seat_assignment}</span>` : ''}
          ${t.terminal ? `<span class="booking-item"><strong>Terminal:</strong> ${t.terminal}</span>` : ''}
          ${t.gate ? `<span class="booking-item"><strong>Gate:</strong> ${t.gate}</span>` : ''}
          ${t.accommodation_name ? `<span class="booking-item"><strong>Hotel:</strong> ${t.accommodation_name}${t.room_type ? ` (${t.room_type})` : ''}</span>` : ''}
          ${t.accommodation_address ? `<span class="booking-item">${t.accommodation_address}</span>` : ''}
          ${t.check_in_date ? `<span class="booking-item"><strong>Check-in:</strong> ${fmtDate(String(t.check_in_date))}</span>` : ''}
          ${t.check_out_date ? `<span class="booking-item"><strong>Check-out:</strong> ${fmtDate(String(t.check_out_date))}</span>` : ''}
          ${t.pickup_address ? `<span class="booking-item"><strong>Pickup:</strong> ${t.pickup_address}${t.pickup_time ? ` at ${t.pickup_time}` : ''}</span>` : ''}
          ${t.return_address ? `<span class="booking-item"><strong>Return:</strong> ${t.return_address}${t.return_time ? ` at ${t.return_time}` : ''}</span>` : ''}
        </div>` : ''}
      </div>`;
  }).join('\n');

  const packingHtml = (packingNotes || equipmentItems.length > 0) ? `
    <div class="section">
      <h2>Packing List</h2>
      ${packingNotes ? `<div class="packing-notes">${packingNotes.replace(/\n/g, '<br>')}</div>` : ''}
      ${equipmentItems.length > 0 ? `
        <ul class="equipment-list">
          ${equipmentItems.map((e) => `
            <li>
              <span class="eq-check">\u2610</span>
              ${e.name}
              ${e.relationship ? `<span class="eq-status">${e.relationship.replace(/_/g, ' ')}</span>` : ''}
            </li>
          `).join('')}
        </ul>
      ` : ''}
    </div>
  ` : '';

  // Compute totals for multi-stop
  let totalsHtml = '';
  if (trips.length > 1) {
    const totalMiles = trips.reduce((s, t) => s + (Number(t.distance_miles) || 0), 0);
    const totalMin = trips.reduce((s, t) => s + (Number(t.duration_min) || 0), 0);
    const totalCost = trips.reduce((s, t) => s + (Number(t.cost) || 0), 0);
    const totalCo2 = trips.reduce((s, t) => s + (Number(t.co2_kg) || 0), 0);
    totalsHtml = `
      <div class="totals">
        <h3>Trip Totals</h3>
        <div class="totals-grid">
          ${totalMiles > 0 ? `<div><strong>${totalMiles.toFixed(1)}</strong> miles</div>` : ''}
          ${totalMin > 0 ? `<div><strong>${totalMin}</strong> minutes</div>` : ''}
          ${totalCost > 0 ? `<div><strong>$${totalCost.toFixed(2)}</strong> estimated cost</div>` : ''}
          ${totalCo2 > 0 ? `<div><strong>${totalCo2.toFixed(1)}</strong> kg CO\u2082</div>` : ''}
        </div>
      </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Itinerary</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px 16px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 4px; }
  h2 { font-size: 1.1rem; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
  h3 { font-size: 1rem; margin-bottom: 8px; }
  .date-range { color: #6b7280; font-size: 0.9rem; margin-bottom: 20px; }
  .section { margin-bottom: 24px; }
  .leg { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
  .leg-date { font-size: 0.8rem; color: #3b82f6; font-weight: 600; margin-bottom: 4px; }
  .leg-header { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
  .leg-num { font-size: 0.75rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; }
  .mode { font-size: 0.85rem; font-weight: 600; text-transform: capitalize; }
  .vehicle { font-size: 0.8rem; color: #6b7280; }
  .leg-route { font-size: 1rem; margin-bottom: 6px; }
  .leg-stats { display: flex; gap: 12px; font-size: 0.8rem; color: #6b7280; flex-wrap: wrap; }
  .leg-notes { font-size: 0.8rem; color: #9ca3af; margin-top: 6px; font-style: italic; }
  .booking-details { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e5e7eb; display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .booking-item { font-size: 0.78rem; color: #6b7280; }
  .packing-notes { font-size: 0.85rem; color: #374151; margin-bottom: 10px; }
  .equipment-list { list-style: none; padding: 0; }
  .equipment-list li { padding: 6px 0; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; }
  .eq-check { font-size: 1.1rem; }
  .eq-status { font-size: 0.7rem; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; color: #6b7280; text-transform: capitalize; }
  .totals { background: #f9fafb; border-radius: 10px; padding: 14px; margin-bottom: 20px; }
  .totals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; font-size: 0.85rem; }
  .footer { text-align: center; font-size: 0.75rem; color: #9ca3af; margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  @media (max-width: 480px) { body { padding: 16px 12px; } .leg-stats { flex-direction: column; gap: 2px; } }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="date-range">${dateRange}</div>
  ${totalsHtml}
  <div class="section">
    <h2>Itinerary</h2>
    ${legsHtml}
  </div>
  ${packingHtml}
  <div class="footer">
    Generated by CentenarianOS &middot; Save as PDF: File &rarr; Print &rarr; Save as PDF
  </div>
  <div class="no-print" style="text-align:center;margin-top:16px">
    <button onclick="window.print()" style="padding:10px 24px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer">
      Print / Save as PDF
    </button>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${title.replace(/[^a-zA-Z0-9 ]/g, '')}-itinerary.html"`,
    },
  });
}
