'use client';

import { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
  onLogged: () => void;
}

export default function QuickLogModal({ isOpen, onClose, jobId, jobNumber, onLogged }: QuickLogModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    work_date: new Date().toISOString().split('T')[0],
    total_hours: '',
    st_hours: '',
    ot_hours: '',
    dt_hours: '',
    notes: '',
    // Expense
    expense_amount: '',
    expense_description: '',
    // Mileage
    mileage_miles: '',
    mileage_cost: '',
  });

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));
  const inputClass = 'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const results: string[] = [];

    // 1. Log time entry
    if (form.work_date && (form.total_hours || form.st_hours)) {
      const res = await fetch(`/api/contractor/jobs/${jobId}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_date: form.work_date,
          total_hours: form.total_hours ? parseFloat(form.total_hours) : null,
          st_hours: form.st_hours ? parseFloat(form.st_hours) : null,
          ot_hours: form.ot_hours ? parseFloat(form.ot_hours) : null,
          dt_hours: form.dt_hours ? parseFloat(form.dt_hours) : null,
          notes: form.notes || null,
        }),
      });
      if (res.ok) results.push('time');
    }

    // 2. Log expense
    if (form.expense_amount && parseFloat(form.expense_amount) > 0) {
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(form.expense_amount),
          type: 'expense',
          description: form.expense_description || `Job ${jobNumber} expense`,
          transaction_date: form.work_date,
          job_id: jobId,
          source: 'job',
          source_module: 'job',
          source_module_id: jobId,
        }),
      });
      if (res.ok) results.push('expense');
    }

    // 3. Log mileage
    if (form.mileage_miles && parseFloat(form.mileage_miles) > 0) {
      const res = await fetch('/api/travel/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'car',
          date: form.work_date,
          distance_miles: parseFloat(form.mileage_miles),
          cost: form.mileage_cost ? parseFloat(form.mileage_cost) : null,
          purpose: `Job ${jobNumber}`,
          tax_category: 'business',
          trip_category: 'travel',
          job_id: jobId,
        }),
      });
      if (res.ok) results.push('mileage');
    }

    setSaving(false);
    if (results.length > 0) {
      onLogged();
      onClose();
      setForm({
        work_date: new Date().toISOString().split('T')[0],
        total_hours: '', st_hours: '', ot_hours: '', dt_hours: '', notes: '',
        expense_amount: '', expense_description: '',
        mileage_miles: '', mileage_cost: '',
      });
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Log">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-neutral-500">
          <Zap size={12} className="inline text-amber-400" /> Log hours, expense, and mileage in one shot for <span className="text-amber-400">{jobNumber}</span>.
        </p>

        {/* Date */}
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Work Date *</label>
          <input type="date" className={inputClass} value={form.work_date} onChange={(e) => set('work_date', e.target.value)} required />
        </div>

        {/* Hours */}
        <fieldset className="space-y-3 rounded-lg border border-neutral-800 p-3">
          <legend className="px-1 text-xs text-neutral-400">Hours</legend>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-xs text-neutral-600 mb-0.5">Total</label>
              <input type="number" step="0.25" className={inputClass} value={form.total_hours} onChange={(e) => set('total_hours', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-neutral-600 mb-0.5">ST</label>
              <input type="number" step="0.25" className={inputClass} value={form.st_hours} onChange={(e) => set('st_hours', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-neutral-600 mb-0.5">OT</label>
              <input type="number" step="0.25" className={inputClass} value={form.ot_hours} onChange={(e) => set('ot_hours', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-neutral-600 mb-0.5">DT</label>
              <input type="number" step="0.25" className={inputClass} value={form.dt_hours} onChange={(e) => set('dt_hours', e.target.value)} />
            </div>
          </div>
          <input className={inputClass} placeholder="Notes (optional)" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </fieldset>

        {/* Expense */}
        <fieldset className="space-y-2 rounded-lg border border-neutral-800 p-3">
          <legend className="px-1 text-xs text-neutral-400">Expense (optional)</legend>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.01" className={inputClass} placeholder="Amount" value={form.expense_amount} onChange={(e) => set('expense_amount', e.target.value)} />
            <input className={inputClass} placeholder="Description" value={form.expense_description} onChange={(e) => set('expense_description', e.target.value)} />
          </div>
        </fieldset>

        {/* Mileage */}
        <fieldset className="space-y-2 rounded-lg border border-neutral-800 p-3">
          <legend className="px-1 text-xs text-neutral-400">Mileage (optional)</legend>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.1" className={inputClass} placeholder="Miles" value={form.mileage_miles} onChange={(e) => set('mileage_miles', e.target.value)} />
            <input type="number" step="0.01" className={inputClass} placeholder="Cost ($)" value={form.mileage_cost} onChange={(e) => set('mileage_cost', e.target.value)} />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          {saving ? 'Logging...' : 'Log All'}
        </button>
      </form>
    </Modal>
  );
}
