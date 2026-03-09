'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Loader2, Trash2, Edit2, X, Save, CreditCard } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface Benefit {
  name: string;
  amount: number;
}

interface RateCard {
  id: string;
  name: string;
  union_local: string | null;
  department: string | null;
  rate_type: string;
  st_rate: number | null;
  ot_rate: number | null;
  dt_rate: number | null;
  benefits: Benefit[];
  travel_benefits: Record<string, number>;
  notes: string | null;
  use_count: number;
}

const EMPTY_FORM = {
  name: '', union_local: '', department: '', rate_type: 'hourly',
  st_rate: '', ot_rate: '', dt_rate: '',
  benefits: [] as Benefit[],
  meal_allowance: '', per_diem: '', mileage_rate: '', extra_pay: '',
  notes: '',
};

export default function RateCardsPage() {
  const [cards, setCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Benefit form
  const [benefitName, setBenefitName] = useState('');
  const [benefitAmount, setBenefitAmount] = useState('');

  async function load() {
    const res = await fetch('/api/contractor/rate-cards');
    const data = await res.json();
    setCards(data.rate_cards ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(card: RateCard) {
    setEditId(card.id);
    setForm({
      name: card.name,
      union_local: card.union_local ?? '',
      department: card.department ?? '',
      rate_type: card.rate_type,
      st_rate: card.st_rate?.toString() ?? '',
      ot_rate: card.ot_rate?.toString() ?? '',
      dt_rate: card.dt_rate?.toString() ?? '',
      benefits: card.benefits ?? [],
      meal_allowance: card.travel_benefits?.meal_allowance?.toString() ?? '',
      per_diem: card.travel_benefits?.per_diem?.toString() ?? '',
      mileage_rate: card.travel_benefits?.mileage_rate?.toString() ?? '',
      extra_pay: card.travel_benefits?.extra_pay?.toString() ?? '',
      notes: card.notes ?? '',
    });
    setModalOpen(true);
  }

  function addBenefit() {
    if (!benefitName.trim() || !benefitAmount) return;
    setForm((p) => ({
      ...p,
      benefits: [...p.benefits, { name: benefitName.trim(), amount: parseFloat(benefitAmount) }],
    }));
    setBenefitName('');
    setBenefitAmount('');
  }

  function removeBenefit(idx: number) {
    setForm((p) => ({
      ...p,
      benefits: p.benefits.filter((_, i) => i !== idx),
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const travelBenefits: Record<string, number> = {};
    if (form.meal_allowance) travelBenefits.meal_allowance = parseFloat(form.meal_allowance);
    if (form.per_diem) travelBenefits.per_diem = parseFloat(form.per_diem);
    if (form.mileage_rate) travelBenefits.mileage_rate = parseFloat(form.mileage_rate);
    if (form.extra_pay) travelBenefits.extra_pay = parseFloat(form.extra_pay);

    const payload = {
      name: form.name,
      union_local: form.union_local || null,
      department: form.department || null,
      rate_type: form.rate_type,
      st_rate: form.st_rate ? parseFloat(form.st_rate) : null,
      ot_rate: form.ot_rate ? parseFloat(form.ot_rate) : null,
      dt_rate: form.dt_rate ? parseFloat(form.dt_rate) : null,
      benefits: form.benefits,
      travel_benefits: Object.keys(travelBenefits).length > 0 ? travelBenefits : {},
      notes: form.notes || null,
    };

    const url = editId ? `/api/contractor/rate-cards/${editId}` : '/api/contractor/rate-cards';
    const method = editId ? 'PATCH' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/contractor/rate-cards/${id}`, { method: 'DELETE' });
    load();
  }

  const inputClass = 'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none';
  const labelClass = 'block text-xs text-neutral-500 mb-1';
  const fmt = (n: number | null) => n != null ? `$${n.toFixed(2)}` : '—';

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Link href="/dashboard/contractor" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 min-h-11 py-2" aria-label="Back to Jobs">
        <ArrowLeft size={14} aria-hidden="true" /> Jobs
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-100">Rate Cards</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-500 min-h-11"
          aria-label="Create new rate card"
        >
          <Plus size={16} aria-hidden="true" /> New Rate Card
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading rate cards" />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          No rate cards yet. Create one to pre-fill rates when creating jobs.
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <CreditCard size={14} className="text-amber-400" aria-hidden="true" />
                  <span className="font-medium text-neutral-100">{card.name}</span>
                  {card.union_local && <span className="text-xs text-neutral-500">{card.union_local}</span>}
                  {card.department && <span className="text-xs text-neutral-500">· {card.department}</span>}
                </div>
                <div className="mt-1 flex gap-4 text-sm text-neutral-400">
                  <span>ST: {fmt(card.st_rate)}</span>
                  <span>OT: {fmt(card.ot_rate)}</span>
                  <span>DT: {fmt(card.dt_rate)}</span>
                  {card.benefits.length > 0 && (
                    <span className="text-neutral-500">{card.benefits.length} benefit{card.benefits.length > 1 ? 's' : ''}</span>
                  )}
                  <span className="text-neutral-500">used {card.use_count}×</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(card)} className="rounded p-2 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 min-h-11 min-w-11 flex items-center justify-center" aria-label={`Edit ${card.name}`}>
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(card.id)} className="rounded p-2 text-neutral-500 hover:bg-neutral-800 hover:text-red-400 min-h-11 min-w-11 flex items-center justify-center" aria-label={`Delete ${card.name}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Rate Card' : 'New Rate Card'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Name *</label>
              <input className={inputClass} placeholder="CBS Sports Camera Op" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <label className={labelClass}>Rate Type</label>
              <select className={inputClass} value={form.rate_type} onChange={(e) => setForm(p => ({ ...p, rate_type: e.target.value }))}>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="flat">Flat</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Union Local</label>
              <input className={inputClass} placeholder="IBEW 1220" value={form.union_local} onChange={(e) => setForm(p => ({ ...p, union_local: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <input className={inputClass} placeholder="Camera" value={form.department} onChange={(e) => setForm(p => ({ ...p, department: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>ST Rate</label>
              <input type="number" step="0.01" className={inputClass} placeholder="41.09" value={form.st_rate} onChange={(e) => setForm(p => ({ ...p, st_rate: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>OT Rate</label>
              <input type="number" step="0.01" className={inputClass} placeholder="61.64" value={form.ot_rate} onChange={(e) => setForm(p => ({ ...p, ot_rate: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>DT Rate</label>
              <input type="number" step="0.01" className={inputClass} placeholder="82.18" value={form.dt_rate} onChange={(e) => setForm(p => ({ ...p, dt_rate: e.target.value }))} />
            </div>
          </div>

          {/* Benefits */}
          <div>
            <label className={labelClass}>Benefits Template</label>
            <div className="space-y-1.5">
              {form.benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-neutral-300">{b.name}</span>
                  <span className="text-neutral-400">${b.amount.toFixed(2)}</span>
                  <button type="button" onClick={() => removeBenefit(i)} className="p-2 text-neutral-500 hover:text-red-400 min-h-11 min-w-11 flex items-center justify-center" aria-label={`Remove ${b.name} benefit`}><X size={14} /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className={inputClass + ' flex-1'} placeholder="IBEW 1220 CBS 401K" value={benefitName} onChange={(e) => setBenefitName(e.target.value)} aria-label="Benefit name" />
              <input type="number" step="0.01" className={inputClass + ' w-24'} placeholder="20.54" value={benefitAmount} onChange={(e) => setBenefitAmount(e.target.value)} aria-label="Benefit amount" />
              <button type="button" onClick={addBenefit} className="rounded-lg border border-neutral-700 px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 min-h-11">Add</button>
            </div>
          </div>

          {/* Travel Benefits */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelClass}>Meal Allowance</label>
              <input type="number" step="0.01" className={inputClass} value={form.meal_allowance} onChange={(e) => setForm(p => ({ ...p, meal_allowance: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Per Diem</label>
              <input type="number" step="0.01" className={inputClass} value={form.per_diem} onChange={(e) => setForm(p => ({ ...p, per_diem: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Mileage Rate</label>
              <input type="number" step="0.01" className={inputClass} value={form.mileage_rate} onChange={(e) => setForm(p => ({ ...p, mileage_rate: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Extra Pay</label>
              <input type="number" step="0.01" className={inputClass} value={form.extra_pay} onChange={(e) => setForm(p => ({ ...p, extra_pay: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea className={inputClass + ' h-16 resize-none'} value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 text-base font-medium text-white hover:bg-amber-500 disabled:opacity-50 min-h-11"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {editId ? 'Update' : 'Create'} Rate Card
          </button>
        </form>
      </Modal>
    </div>
  );
}
