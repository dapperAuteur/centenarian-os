'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';

const RATE_TYPES = ['hourly', 'daily', 'flat'];
const STATUSES = ['assigned', 'confirmed', 'in_progress', 'completed'];

export default function NewJobPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    job_number: '',
    client_name: '',
    client_id: null as string | null,
    event_name: '',
    location_name: '',
    poc_name: '',
    poc_phone: '',
    crew_coordinator_name: '',
    crew_coordinator_phone: '',
    status: 'assigned',
    start_date: '',
    end_date: '',
    pay_rate: '',
    ot_rate: '',
    dt_rate: '',
    rate_type: 'hourly',
    distance_from_home_miles: '',
    benefits_eligible: false,
    union_local: '',
    department: '',
    est_pay_date: '',
    notes: '',
    // Travel benefits
    meal_allowance: '',
    per_diem: '',
    mileage_rate: '',
    extra_pay: '',
  });

  const set = (field: string, value: string | boolean | null) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const travelBenefits: Record<string, number> = {};
    if (form.meal_allowance) travelBenefits.meal_allowance = parseFloat(form.meal_allowance);
    if (form.per_diem) travelBenefits.per_diem = parseFloat(form.per_diem);
    if (form.mileage_rate) travelBenefits.mileage_rate = parseFloat(form.mileage_rate);
    if (form.extra_pay) travelBenefits.extra_pay = parseFloat(form.extra_pay);

    const res = await fetch('/api/contractor/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_number: form.job_number,
        client_name: form.client_name,
        client_id: form.client_id,
        event_name: form.event_name || null,
        location_name: form.location_name || null,
        poc_name: form.poc_name || null,
        poc_phone: form.poc_phone || null,
        crew_coordinator_name: form.crew_coordinator_name || null,
        crew_coordinator_phone: form.crew_coordinator_phone || null,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        pay_rate: form.pay_rate ? parseFloat(form.pay_rate) : null,
        ot_rate: form.ot_rate ? parseFloat(form.ot_rate) : null,
        dt_rate: form.dt_rate ? parseFloat(form.dt_rate) : null,
        rate_type: form.rate_type,
        distance_from_home_miles: form.distance_from_home_miles ? parseFloat(form.distance_from_home_miles) : null,
        benefits_eligible: form.benefits_eligible,
        travel_benefits: Object.keys(travelBenefits).length > 0 ? travelBenefits : {},
        union_local: form.union_local || null,
        department: form.department || null,
        est_pay_date: form.est_pay_date || null,
        notes: form.notes || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to create job');
      setSaving(false);
      return;
    }

    const job = await res.json();
    router.push(`/dashboard/contractor/jobs/${job.id}`);
  }

  const inputClass =
    'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none';
  const labelClass = 'block text-sm font-medium text-neutral-300 mb-1';

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Link href="/dashboard/contractor" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200">
        <ArrowLeft size={14} /> Back to Jobs
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-neutral-100">New Job</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Job Info */}
        <fieldset className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <legend className="px-2 text-sm font-semibold text-neutral-200">Job Info</legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Job Number *</label>
              <input
                className={inputClass}
                placeholder="J-223680"
                value={form.job_number}
                onChange={(e) => set('job_number', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Client *</label>
            <ContactAutocomplete
              contactType="customer"
              value={form.client_name}
              onChange={(name, id) => { set('client_name', name); set('client_id', id ?? null); }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Event Name</label>
              <input className={inputClass} placeholder="2026 BIG10 Women's Championship" value={form.event_name} onChange={(e) => set('event_name', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Location / Venue</label>
              <input className={inputClass} placeholder="Gainbridge Fieldhouse" value={form.location_name} onChange={(e) => set('location_name', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Start Date</label>
              <input type="date" className={inputClass} value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input type="date" className={inputClass} value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Union Local</label>
              <input className={inputClass} placeholder="IBEW 1220, IATSE 317" value={form.union_local} onChange={(e) => set('union_local', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <input className={inputClass} placeholder="Camera, Audio, Graphics" value={form.department} onChange={(e) => set('department', e.target.value)} />
            </div>
          </div>
        </fieldset>

        {/* Contacts */}
        <fieldset className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <legend className="px-2 text-sm font-semibold text-neutral-200">Contacts</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>POC Name</label>
              <input className={inputClass} placeholder="Michael Aagaard" value={form.poc_name} onChange={(e) => set('poc_name', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>POC Phone</label>
              <input className={inputClass} placeholder="555-0123" value={form.poc_phone} onChange={(e) => set('poc_phone', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Crew Coordinator</label>
              <input className={inputClass} placeholder="Mike Brennan" value={form.crew_coordinator_name} onChange={(e) => set('crew_coordinator_name', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Coordinator Phone</label>
              <input className={inputClass} placeholder="555-0456" value={form.crew_coordinator_phone} onChange={(e) => set('crew_coordinator_phone', e.target.value)} />
            </div>
          </div>
        </fieldset>

        {/* Pay Rates */}
        <fieldset className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <legend className="px-2 text-sm font-semibold text-neutral-200">Pay Rates</legend>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className={labelClass}>Rate Type</label>
              <select className={inputClass} value={form.rate_type} onChange={(e) => set('rate_type', e.target.value)}>
                {RATE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>ST Rate</label>
              <input type="number" step="0.01" className={inputClass} placeholder="41.09" value={form.pay_rate} onChange={(e) => set('pay_rate', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>OT Rate</label>
              <input type="number" step="0.01" className={inputClass} placeholder="61.64" value={form.ot_rate} onChange={(e) => set('ot_rate', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>DT Rate</label>
              <input type="number" step="0.01" className={inputClass} placeholder="82.18" value={form.dt_rate} onChange={(e) => set('dt_rate', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Est. Pay Date</label>
              <input type="date" className={inputClass} value={form.est_pay_date} onChange={(e) => set('est_pay_date', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Distance from Home (mi)</label>
              <input type="number" step="0.1" className={inputClass} placeholder="150" value={form.distance_from_home_miles} onChange={(e) => set('distance_from_home_miles', e.target.value)} />
            </div>
          </div>
        </fieldset>

        {/* Benefits */}
        <fieldset className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <legend className="px-2 text-sm font-semibold text-neutral-200">Travel Benefits</legend>
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={form.benefits_eligible}
              onChange={(e) => set('benefits_eligible', e.target.checked)}
              className="rounded border-neutral-600"
            />
            Benefits Eligible
          </label>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className={labelClass}>Meal Allowance</label>
              <input type="number" step="0.01" className={inputClass} placeholder="25.00" value={form.meal_allowance} onChange={(e) => set('meal_allowance', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Per Diem</label>
              <input type="number" step="0.01" className={inputClass} placeholder="75.00" value={form.per_diem} onChange={(e) => set('per_diem', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Mileage Rate</label>
              <input type="number" step="0.01" className={inputClass} placeholder="0.67" value={form.mileage_rate} onChange={(e) => set('mileage_rate', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Extra Pay</label>
              <input type="number" step="0.01" className={inputClass} placeholder="0.00" value={form.extra_pay} onChange={(e) => set('extra_pay', e.target.value)} />
            </div>
          </div>
        </fieldset>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={inputClass + ' h-24 resize-none'}
            placeholder="Additional job notes..."
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Creating...' : 'Create Job'}
        </button>
      </form>
    </div>
  );
}
