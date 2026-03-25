import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createLinkedTransaction,
  updateLinkedTransaction,
  deleteLinkedTransaction,
} from '@/lib/finance/linked-transaction';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const vehicleId = params.get('vehicle_id');
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200);
  const offset = parseInt(params.get('offset') || '0');

  let query = supabase
    .from('fuel_logs')
    .select('*, vehicles(id, nickname, type)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (vehicleId) query = query.eq('vehicle_id', vehicleId);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data || [], total: count || 0 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    vehicle_id, date, odometer_miles, miles_since_last_fill, miles_this_month,
    mpg_display, gallons, total_cost, cost_per_gallon, fuel_grade,
    station, source, notes, finance_category_id,
  } = body;

  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 });

  const mpg_calculated =
    miles_since_last_fill && gallons && gallons > 0
      ? parseFloat((miles_since_last_fill / gallons).toFixed(2))
      : null;

  const cpg =
    cost_per_gallon ??
    (total_cost && gallons && gallons > 0
      ? parseFloat((total_cost / gallons).toFixed(3))
      : null);

  const { data, error } = await supabase
    .from('fuel_logs')
    .insert({
      user_id: user.id,
      vehicle_id: vehicle_id || null,
      date,
      odometer_miles,
      miles_since_last_fill,
      miles_this_month,
      mpg_display,
      mpg_calculated,
      gallons,
      total_cost,
      cost_per_gallon: cpg,
      fuel_grade,
      station,
      source: source || 'manual',
      notes,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Initialize gallons_remaining if FIFO is enabled for this user
  if (gallons && gallons > 0 && vehicle_id) {
    const { data: settings } = await supabase
      .from('travel_settings')
      .select('fifo_enabled_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settings?.fifo_enabled_at) {
      const cutoff = new Date(settings.fifo_enabled_at).toISOString().slice(0, 10);
      if (date >= cutoff) {
        await supabase
          .from('fuel_logs')
          .update({ gallons_remaining: gallons })
          .eq('id', data.id);
        data.gallons_remaining = gallons;
      }
    }
  }

  // Auto-create linked finance transaction if cost is provided
  if (total_cost && total_cost > 0) {
    try {
      const grade = fuel_grade ? ` – ${fuel_grade}` : '';
      const txId = await createLinkedTransaction(supabase, {
        userId: user.id,
        amount: total_cost,
        vendor: station ?? null,
        date,
        source_module: 'fuel_log',
        source_module_id: data.id,
        description: `Fuel${grade}`,
        category_id: finance_category_id ?? null,
      });
      await supabase.from('fuel_logs').update({ transaction_id: txId }).eq('id', data.id);
      data.transaction_id = txId;
    } catch {
      // Non-fatal — log link failure but still return the fuel record
    }
  }

  return NextResponse.json({ log: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Fetch existing record for derived-field recalculation and transaction sync
  const { data: existing } = await supabase
    .from('fuel_logs')
    .select('miles_since_last_fill, gallons, total_cost, station, date, transaction_id, gallons_remaining')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Recalculate MPG if source values changed
  if (updates.miles_since_last_fill !== undefined || updates.gallons !== undefined) {
    const miles = updates.miles_since_last_fill ?? existing.miles_since_last_fill;
    const gals = updates.gallons ?? existing.gallons;
    if (miles && gals && gals > 0) {
      updates.mpg_calculated = parseFloat((miles / gals).toFixed(2));
    }
  }

  // Adjust gallons_remaining if gallons changed on a FIFO-tracked log
  if (updates.gallons !== undefined && existing.gallons_remaining !== null) {
    const oldGallons = Number(existing.gallons);
    const newGallons = Number(updates.gallons);
    const delta = newGallons - oldGallons;
    const newRemaining = Math.max(0, Number(existing.gallons_remaining) + delta);
    updates.gallons_remaining = parseFloat(newRemaining.toFixed(3));
  }

  const { data, error } = await supabase
    .from('fuel_logs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync linked finance transaction if cost-related fields changed
  const costChanged = updates.total_cost !== undefined;
  const vendorChanged = updates.station !== undefined;
  const dateChanged = updates.date !== undefined;

  if (costChanged || vendorChanged || dateChanged) {
    const newCost = updates.total_cost ?? existing.total_cost;
    const newVendor = updates.station ?? existing.station;
    const newDate = updates.date ?? existing.date;

    if (existing.transaction_id) {
      if (!newCost || newCost <= 0) {
        // Cost removed — delete linked transaction
        try {
          await deleteLinkedTransaction(supabase, existing.transaction_id);
          await supabase.from('fuel_logs').update({ transaction_id: null }).eq('id', id);
        } catch { /* non-fatal */ }
      } else {
        try {
          await updateLinkedTransaction(supabase, existing.transaction_id, {
            amount: newCost,
            vendor: newVendor,
            date: newDate,
          });
        } catch { /* non-fatal */ }
      }
    } else if (newCost && newCost > 0) {
      // Cost added for the first time — create linked transaction
      try {
        const txId = await createLinkedTransaction(supabase, {
          userId: user.id,
          amount: newCost,
          vendor: newVendor ?? null,
          date: newDate,
          source_module: 'fuel_log',
          source_module_id: id,
          description: `Fuel`,
        });
        await supabase.from('fuel_logs').update({ transaction_id: txId }).eq('id', id);
        data.transaction_id = txId;
      } catch { /* non-fatal */ }
    }
  }

  return NextResponse.json({ log: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Check for linked finance transaction before deleting
  const { data: existing } = await supabase
    .from('fuel_logs')
    .select('transaction_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Find trips that have FIFO allocations from this fuel log (before cascade deletes them)
  const { data: affectedAllocations } = await supabase
    .from('fuel_allocations')
    .select('trip_id')
    .eq('fuel_log_id', id);

  const affectedTripIds = affectedAllocations
    ? [...new Set(affectedAllocations.map((a) => a.trip_id))]
    : [];

  const { error } = await supabase
    .from('fuel_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reset FIFO cost on affected trips (their allocations were cascade-deleted)
  if (affectedTripIds.length > 0) {
    await supabase
      .from('trips')
      .update({ fifo_cost: null, cost_source: 'manual' })
      .in('id', affectedTripIds);
  }

  return NextResponse.json({
    ok: true,
    hasLinkedTransaction: !!existing.transaction_id,
    transactionId: existing.transaction_id ?? null,
  });
}
