'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Gauge, Wrench, DollarSign, Copy, Trash2, Loader2, MapPin, Clock,
} from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';

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
  transaction_id: string | null;
  vehicles: { id: string; nickname: string; type: string } | null;
}

interface LinkedTransaction {
  id: string;
  amount: number;
  transaction_date: string;
  description: string;
}

const SERVICE_LABELS: Record<string, string> = {
  oil_change: 'Oil Change',
  tire_rotation: 'Tire Rotation',
  brake_pads: 'Brake Pads',
  inspection: 'Inspection',
  battery: 'Battery',
  transmission: 'Transmission',
  tires: 'Tires',
  chain: 'Chain',
  tune_up: 'Tune-up',
  other: 'Other',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<MaintenanceRecord | null>(null);
  const [linkedTx, setLinkedTx] = useState<LinkedTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/travel/maintenance/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRecord(data.maintenance || null);
        setLinkedTx(data.linked_transaction || null);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDuplicate = async () => {
    setActionLoading('duplicate');
    try {
      const res = await offlineFetch(`/api/travel/maintenance/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/travel/maintenance/${data.id}`);
      }
    } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this maintenance record?')) return;
    setActionLoading('delete');
    try {
      const res = await offlineFetch('/api/travel/maintenance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) router.push('/dashboard/travel/maintenance');
    } finally { setActionLoading(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-amber-600" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Maintenance record not found.</p>
        <Link href="/dashboard/travel/maintenance" className="text-amber-600 hover:underline mt-2 inline-block">Back to maintenance</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/travel/maintenance" className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <Wrench className="w-3 h-3" />
                {SERVICE_LABELS[record.service_type] || record.service_type}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {SERVICE_LABELS[record.service_type] || record.service_type}
            </h1>
            {record.vehicles && <p className="text-gray-500 text-sm">{record.vehicles.nickname}</p>}
          </div>
        </div>
        {record.cost != null && record.cost > 0 && (
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">${Number(record.cost).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400 text-xs block">Service Date</span>
            <span className="text-gray-900 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {fmtDate(record.date)}
            </span>
          </div>
          {record.odometer_at_service != null && (
            <div>
              <span className="text-gray-400 text-xs block">Odometer</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-gray-400" />
                {record.odometer_at_service.toLocaleString()} mi
              </span>
            </div>
          )}
          {record.vendor && (
            <div>
              <span className="text-gray-400 text-xs block">Service Provider</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {record.vendor}
              </span>
            </div>
          )}
        </div>

        {(record.next_service_miles != null || record.next_service_date != null) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <h4 className="text-xs font-medium text-amber-800 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Next Service
            </h4>
            <div className="flex gap-4 text-sm text-amber-700">
              {record.next_service_miles != null && (
                <span>At {record.next_service_miles.toLocaleString()} mi</span>
              )}
              {record.next_service_date && (
                <span>By {fmtDate(record.next_service_date)}</span>
              )}
            </div>
          </div>
        )}

        {record.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{record.notes}</div>
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

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDuplicate}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 disabled:opacity-50 transition"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button
            onClick={handleDelete}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />}
        </div>
      </div>

      {/* Activity Links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <ActivityLinker entityType="maintenance" entityId={record.id} />
      </div>

      {/* Life Categories */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <LifeCategoryTagger entityType="maintenance" entityId={record.id} />
      </div>
    </div>
  );
}
