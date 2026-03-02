'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Gauge, Fuel, DollarSign, Copy, Trash2, Loader2, MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';

interface FuelLog {
  id: string;
  date: string;
  odometer_miles: number | null;
  miles_since_last_fill: number | null;
  miles_this_month: number | null;
  mpg_display: number | null;
  mpg_calculated: number | null;
  gallons: number | null;
  total_cost: number | null;
  cost_per_gallon: number | null;
  fuel_grade: string | null;
  station: string | null;
  source: string;
  notes: string | null;
  transaction_id: string | null;
  vehicles: { id: string; nickname: string; type: string } | null;
}

interface LinkedTransaction {
  id: string;
  amount: number;
  transaction_date: string;
  description: string;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FuelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [fuelLog, setFuelLog] = useState<FuelLog | null>(null);
  const [linkedTx, setLinkedTx] = useState<LinkedTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/travel/fuel/${id}`);
      if (res.ok) {
        const data = await res.json();
        setFuelLog(data.fuel_log || null);
        setLinkedTx(data.linked_transaction || null);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDuplicate = async () => {
    setActionLoading('duplicate');
    try {
      const res = await offlineFetch(`/api/travel/fuel/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/travel/fuel/${data.id}`);
      }
    } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this fuel log?')) return;
    setActionLoading('delete');
    try {
      const res = await offlineFetch('/api/travel/fuel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) router.push('/dashboard/travel/fuel');
    } finally { setActionLoading(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-sky-600" />
      </div>
    );
  }

  if (!fuelLog) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Fuel log not found.</p>
        <Link href="/dashboard/travel/fuel" className="text-sky-600 hover:underline mt-2 inline-block">Back to fuel logs</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/travel/fuel" className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                <Fuel className="w-3 h-3" />
                Fill-up
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {fuelLog.station || 'Fuel Log'} — {fmtDate(fuelLog.date)}
            </h1>
            {fuelLog.vehicles && <p className="text-gray-500 text-sm">{fuelLog.vehicles.nickname}</p>}
          </div>
        </div>
        {fuelLog.total_cost != null && (
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">${Number(fuelLog.total_cost).toFixed(2)}</div>
            {fuelLog.gallons != null && (
              <div className="text-sm text-gray-500">{Number(fuelLog.gallons).toFixed(3)} gal</div>
            )}
          </div>
        )}
      </div>

      {/* Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400 text-xs block">Date</span>
            <span className="text-gray-900 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {fmtDate(fuelLog.date)}
            </span>
          </div>
          {fuelLog.odometer_miles != null && (
            <div>
              <span className="text-gray-400 text-xs block">Odometer</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-gray-400" />
                {fuelLog.odometer_miles.toLocaleString()} mi
              </span>
            </div>
          )}
          {fuelLog.station && (
            <div>
              <span className="text-gray-400 text-xs block">Station</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {fuelLog.station}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {fuelLog.miles_since_last_fill != null && (
            <div>
              <span className="text-gray-400 text-xs block">Miles Since Last Fill</span>
              <span className="text-gray-900 font-medium">{fuelLog.miles_since_last_fill.toLocaleString()} mi</span>
            </div>
          )}
          {fuelLog.mpg_calculated != null && (
            <div>
              <span className="text-gray-400 text-xs block">MPG (Calculated)</span>
              <span className="text-green-700 font-medium">{Number(fuelLog.mpg_calculated).toFixed(1)} mpg</span>
            </div>
          )}
          {fuelLog.mpg_display != null && (
            <div>
              <span className="text-gray-400 text-xs block">MPG (Display)</span>
              <span className="text-gray-900 font-medium">{Number(fuelLog.mpg_display).toFixed(1)} mpg</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {fuelLog.gallons != null && (
            <div>
              <span className="text-gray-400 text-xs block">Gallons</span>
              <span className="text-gray-900 font-medium">{Number(fuelLog.gallons).toFixed(3)} gal</span>
            </div>
          )}
          {fuelLog.cost_per_gallon != null && (
            <div>
              <span className="text-gray-400 text-xs block">Price/Gallon</span>
              <span className="text-gray-900 font-medium">${Number(fuelLog.cost_per_gallon).toFixed(3)}</span>
            </div>
          )}
          {fuelLog.fuel_grade && (
            <div>
              <span className="text-gray-400 text-xs block">Grade</span>
              <span className="text-gray-900 font-medium">{fuelLog.fuel_grade}</span>
            </div>
          )}
        </div>

        {fuelLog.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{fuelLog.notes}</div>
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
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 disabled:opacity-50 transition"
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
        <ActivityLinker entityType="fuel_log" entityId={fuelLog.id} />
      </div>

      {/* Life Categories */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <LifeCategoryTagger entityType="fuel_log" entityId={fuelLog.id} />
      </div>
    </div>
  );
}
