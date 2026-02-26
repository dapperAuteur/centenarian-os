'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, AlertCircle, Wrench } from 'lucide-react';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface MaintenanceRecord {
  id: string;
  date: string;
  service_type: string;
  odometer_at_service: number | null;
  cost: number | null;
  vendor: string | null;
  notes: string | null;
  next_service_miles: number | null;
  next_service_date: string | null;
  vehicles?: { id: string; nickname: string; type: string } | null;
}

interface Vehicle {
  id: string;
  nickname: string;
  type: string;
}

const SERVICE_LABELS: Record<string, string> = {
  oil_change: 'Oil Change',
  tire_rotation: 'Tire Rotation',
  brake_pads: 'Brake Pads',
  inspection: 'Inspection',
  battery: 'Battery',
  transmission: 'Transmission',
  tires: 'Tires',
  chain: 'Chain Service',
  tune_up: 'Tune-Up',
  other: 'Other',
};

const BLANK_FORM = {
  vehicle_id: '',
  service_type: 'oil_change',
  date: new Date().toISOString().split('T')[0],
  odometer_at_service: '',
  cost: '',
  vendor: '',
  notes: '',
  next_service_miles: '',
  next_service_date: '',
  finance_category_id: '',
};

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

interface FinanceCategory { id: string; name: string; color: string; }

export default function MaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkedTxDialog, setLinkedTxDialog] = useState<{ transactionId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, vehiclesRes, catRes] = await Promise.all([
        offlineFetch('/api/travel/maintenance'),
        offlineFetch('/api/travel/vehicles'),
        offlineFetch('/api/finance/categories'),
      ]);
      if (recRes.ok) {
        const d = await recRes.json();
        setRecords(d.records || []);
      }
      if (vehiclesRes.ok) {
        const d = await vehiclesRes.json();
        setVehicles(d.vehicles || []);
      }
      if (catRes.ok) {
        const d = await catRes.json();
        setFinanceCategories(d.categories || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEdit = (r: MaintenanceRecord) => {
    setEditingId(r.id);
    setForm({
      vehicle_id: r.vehicles?.id ?? '',
      service_type: r.service_type,
      date: r.date,
      odometer_at_service: r.odometer_at_service != null ? String(r.odometer_at_service) : '',
      cost: r.cost != null ? String(r.cost) : '',
      vendor: r.vendor ?? '',
      notes: r.notes ?? '',
      next_service_miles: r.next_service_miles != null ? String(r.next_service_miles) : '',
      next_service_date: r.next_service_date ?? '',
      finance_category_id: '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        vehicle_id: form.vehicle_id || null,
        service_type: form.service_type,
        date: form.date,
        odometer_at_service: form.odometer_at_service ? parseFloat(form.odometer_at_service) : null,
        cost: form.cost ? parseFloat(form.cost) : null,
        vendor: form.vendor || null,
        notes: form.notes || null,
        next_service_miles: form.next_service_miles ? parseFloat(form.next_service_miles) : null,
        next_service_date: form.next_service_date || null,
        finance_category_id: form.finance_category_id || null,
      };
      const res = await offlineFetch('/api/travel/maintenance', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowForm(false);
        setForm(BLANK_FORM);
        setEditingId(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this maintenance record?')) return;
    const res = await offlineFetch('/api/travel/maintenance', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.hasLinkedTransaction) setLinkedTxDialog({ transactionId: d.transactionId });
    }
    load();
  };

  const handleLinkedTxYes = async () => {
    if (!linkedTxDialog) return;
    await offlineFetch('/api/finance/transactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: linkedTxDialog.transactionId }),
    });
    setLinkedTxDialog(null);
  };

  // Group by vehicle
  const byVehicle: Record<string, { vehicle: Vehicle | null; records: MaintenanceRecord[] }> = {};
  for (const r of records) {
    const key = r.vehicles?.id ?? 'none';
    if (!byVehicle[key]) byVehicle[key] = { vehicle: r.vehicles ?? null, records: [] };
    byVehicle[key].records.push(r);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/travel" className="text-gray-400 hover:text-gray-600 transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Maintenance Log</h1>
            <p className="text-sm text-gray-500">{records.length} service records</p>
          </div>
        </div>
        <button
          onClick={() => { setForm(BLANK_FORM); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {vehicles.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            Add your vehicles first on the{' '}
            <Link href="/dashboard/travel" className="underline font-medium">Travel dashboard</Link>{' '}
            before logging maintenance.
          </p>
        </div>
      )}

      {records.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">
          <Wrench className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No maintenance records yet.</p>
          <p className="text-gray-400 text-xs mt-1">Log oil changes, tire rotations, and more.</p>
        </div>
      ) : (
        Object.values(byVehicle).map(({ vehicle, records: vRecords }) => (
          <div key={vehicle?.id ?? 'none'} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">
                {vehicle ? `${vehicle.type === 'car' ? '🚗' : '🚲'} ${vehicle.nickname}` : 'Unassigned'}
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {vRecords.map((r) => (
                <div key={r.id} className="px-5 py-4 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {SERVICE_LABELS[r.service_type] ?? r.service_type}
                      </span>
                      {r.cost != null && (
                        <span className="text-xs text-gray-500">{fmtMoney(r.cost)}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {r.date}
                      {r.odometer_at_service && ` · ${r.odometer_at_service.toLocaleString()} mi`}
                      {r.vendor && ` · ${r.vendor}`}
                    </p>
                    {(r.next_service_miles || r.next_service_date) && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Next: {r.next_service_date ?? `@ ${r.next_service_miles?.toLocaleString()} mi`}
                      </p>
                    )}
                    {r.notes && <p className="text-xs text-gray-600 mt-0.5">{r.notes}</p>}
                  </div>
                  <div className="flex gap-3 ml-4 shrink-0">
                    <button
                      onClick={() => handleEdit(r)}
                      className="text-xs text-sky-500 hover:text-sky-700 transition"
                    >
                      edit
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition"
                    >
                      del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Linked transaction confirmation dialog */}
      {linkedTxDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h2 className="text-base font-bold text-gray-900">Delete linked transaction?</h2>
            <p className="text-sm text-gray-600">
              This service record had a linked finance expense. Do you also want to delete it?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setLinkedTxDialog(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Keep transaction
              </button>
              <button
                onClick={handleLinkedTxYes}
                className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-700 transition"
              >
                Delete it too
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Service Record' : 'Log Service'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Service Type *</label>
                <select value={form.service_type}
                  onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input type="date" value={form.date} required
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            {vehicles.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                <select value={form.vehicle_id}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Odometer</label>
                <input type="number" step="0.1" value={form.odometer_at_service} placeholder="98832"
                  onChange={(e) => setForm((f) => ({ ...f, odometer_at_service: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cost ($)</label>
                <input type="number" step="0.01" value={form.cost} placeholder="0.00"
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Shop / Vendor</label>
              <ContactAutocomplete
                value={form.vendor}
                contactType="vendor"
                placeholder="Jiffy Lube"
                onChange={(name) => setForm((f) => ({ ...f, vendor: name }))}
                inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {financeCategories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Finance Category</label>
                <select
                  value={form.finance_category_id}
                  onChange={(e) => setForm((f) => ({ ...f, finance_category_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Uncategorized</option>
                  {financeCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Next service (miles)</label>
                <input type="number" value={form.next_service_miles} placeholder="103000"
                  onChange={(e) => setForm((f) => ({ ...f, next_service_miles: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Next service date</label>
                <input type="date" value={form.next_service_date}
                  onChange={(e) => setForm((f) => ({ ...f, next_service_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input type="text" value={form.notes} placeholder="Optional notes"
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-sky-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Update Record' : 'Save Record'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
