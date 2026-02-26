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
  const vehicleId = params.get('vehicle_id');

  let query = supabase
    .from('vehicle_maintenance')
    .select('*, vehicles(id, nickname, type)')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (vehicleId) query = query.eq('vehicle_id', vehicleId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    vehicle_id, service_type, date, odometer_at_service,
    cost, vendor, notes, next_service_miles, next_service_date, finance_category_id,
  } = body;

  if (!service_type || !date) {
    return NextResponse.json({ error: 'service_type and date are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('vehicle_maintenance')
    .insert({
      user_id: user.id,
      vehicle_id: vehicle_id || null,
      service_type,
      date,
      odometer_at_service,
      cost,
      vendor,
      notes,
      next_service_miles,
      next_service_date,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-create linked finance transaction if cost is provided
  if (cost && cost > 0) {
    try {
      const txId = await createLinkedTransaction(supabase, {
        userId: user.id,
        amount: cost,
        vendor: vendor ?? null,
        date,
        source_module: 'vehicle_maintenance',
        source_module_id: data.id,
        description: service_type,
        category_id: finance_category_id ?? null,
      });
      await supabase.from('vehicle_maintenance').update({ transaction_id: txId }).eq('id', data.id);
      data.transaction_id = txId;
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ record: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Fetch existing record for transaction sync
  const { data: existing } = await supabase
    .from('vehicle_maintenance')
    .select('cost, vendor, date, transaction_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('vehicle_maintenance')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync linked finance transaction if cost-related fields changed
  const costChanged = updates.cost !== undefined;
  const vendorChanged = updates.vendor !== undefined;
  const dateChanged = updates.date !== undefined;

  if (costChanged || vendorChanged || dateChanged) {
    const newCost = updates.cost ?? existing.cost;
    const newVendor = updates.vendor ?? existing.vendor;
    const newDate = updates.date ?? existing.date;

    if (existing.transaction_id) {
      if (!newCost || newCost <= 0) {
        try {
          await deleteLinkedTransaction(supabase, existing.transaction_id);
          await supabase.from('vehicle_maintenance').update({ transaction_id: null }).eq('id', id);
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
      try {
        const txId = await createLinkedTransaction(supabase, {
          userId: user.id,
          amount: newCost,
          vendor: newVendor ?? null,
          date: newDate,
          source_module: 'vehicle_maintenance',
          source_module_id: id,
          description: updates.service_type ?? data.service_type,
        });
        await supabase.from('vehicle_maintenance').update({ transaction_id: txId }).eq('id', id);
        data.transaction_id = txId;
      } catch { /* non-fatal */ }
    }
  }

  return NextResponse.json({ record: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Check for linked finance transaction before deleting
  const { data: existing } = await supabase
    .from('vehicle_maintenance')
    .select('transaction_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('vehicle_maintenance')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    hasLinkedTransaction: !!existing.transaction_id,
    transactionId: existing.transaction_id ?? null,
  });
}
