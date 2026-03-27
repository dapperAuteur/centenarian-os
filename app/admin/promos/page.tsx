'use client';

// app/admin/promos/page.tsx
// Admin promo campaign management — create, activate/deactivate, track usage.

import { useEffect, useState } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { Plus, Loader2, Tag, ToggleLeft, ToggleRight, Calendar, Hash } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed' | 'free_months';
  discount_value: number;
  stripe_coupon_id: string | null;
  plan_types: string[];
  promo_code: string | null;
  start_date: string;
  end_date: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
}

const DISCOUNT_LABELS: Record<string, string> = {
  percentage: '% off',
  fixed: '$ off',
  free_months: 'free month(s)',
};

export default function AdminPromosPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<'percentage' | 'fixed' | 'free_months'>('percentage');
  const [formValue, setFormValue] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formMaxUses, setFormMaxUses] = useState('');

  useEffect(() => {
    offlineFetch('/api/admin/promos')
      .then((r) => r.json())
      .then((d) => { setCampaigns(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!formName || !formValue) return;
    setCreating(true);
    try {
      const res = await offlineFetch('/api/admin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDesc || null,
          discount_type: formType,
          discount_value: Number(formValue),
          promo_code: formCode || null,
          end_date: formEndDate || null,
          max_uses: formMaxUses ? Number(formMaxUses) : null,
        }),
      });
      if (res.ok) {
        const campaign = await res.json();
        setCampaigns((prev) => [campaign, ...prev]);
        setShowCreate(false);
        setFormName(''); setFormDesc(''); setFormType('percentage'); setFormValue(''); setFormCode(''); setFormEndDate(''); setFormMaxUses('');
      }
    } catch { /* ignore */ }
    setCreating(false);
  }

  async function handleToggle(id: string, currentActive: boolean) {
    setToggling(id);
    try {
      const res = await offlineFetch('/api/admin/promos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      });
      if (res.ok) {
        setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, is_active: !currentActive } : c));
      }
    } catch { /* ignore */ }
    setToggling(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  const active = campaigns.filter((c) => c.is_active);
  const inactive = campaigns.filter((c) => !c.is_active);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6 text-fuchsia-400" />
          <h1 className="text-2xl font-bold text-white">Promo Campaigns</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition min-h-11"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Active campaigns */}
      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Active ({active.length})</h2>
          <div className="space-y-3">
            {active.map((c) => (
              <CampaignCard key={c.id} campaign={c} onToggle={handleToggle} toggling={toggling} />
            ))}
          </div>
        </div>
      )}

      {/* Inactive campaigns */}
      {inactive.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Inactive ({inactive.length})</h2>
          <div className="space-y-3">
            {inactive.map((c) => (
              <CampaignCard key={c.id} campaign={c} onToggle={handleToggle} toggling={toggling} />
            ))}
          </div>
        </div>
      )}

      {campaigns.length === 0 && (
        <div className="text-center py-16 bg-gray-900 border border-dashed border-gray-800 rounded-xl">
          <Tag className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500 text-sm">No promo campaigns yet.</p>
          <p className="text-gray-600 text-xs mt-1">Create one to offer lifetime membership discounts.</p>
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Promo Campaign">
        <div className="dark-input space-y-4">
          <div>
            <label htmlFor="promo-name" className="block text-sm font-medium text-gray-300 mb-1">Campaign Name</label>
            <input id="promo-name" type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Spring Lifetime Sale" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500" />
          </div>
          <div>
            <label htmlFor="promo-desc" className="block text-sm font-medium text-gray-300 mb-1">Description (optional)</label>
            <input id="promo-desc" type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Limited time offer for new signups" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="promo-type" className="block text-sm font-medium text-gray-300 mb-1">Discount Type</label>
              <select id="promo-type" value={formType} onChange={(e) => setFormType(e.target.value as typeof formType)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500">
                <option value="percentage">Percentage Off</option>
                <option value="fixed">Fixed Amount Off</option>
                <option value="free_months">Free Months</option>
              </select>
            </div>
            <div>
              <label htmlFor="promo-value" className="block text-sm font-medium text-gray-300 mb-1">
                {formType === 'percentage' ? 'Percent Off' : formType === 'fixed' ? 'Amount ($)' : 'Months Free'}
              </label>
              <input id="promo-value" type="number" min="1" value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder={formType === 'percentage' ? '20' : formType === 'fixed' ? '25' : '1'} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500" />
            </div>
          </div>
          <div>
            <label htmlFor="promo-code" className="block text-sm font-medium text-gray-300 mb-1">Promo Code (optional)</label>
            <input id="promo-code" type="text" value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())} placeholder="SPRING2026" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-fuchsia-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="promo-end" className="block text-sm font-medium text-gray-300 mb-1">End Date (optional)</label>
              <input id="promo-end" type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500" />
            </div>
            <div>
              <label htmlFor="promo-max" className="block text-sm font-medium text-gray-300 mb-1">Max Uses (optional)</label>
              <input id="promo-max" type="number" min="1" value={formMaxUses} onChange={(e) => setFormMaxUses(e.target.value)} placeholder="50" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500" />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !formName || !formValue}
            className="w-full px-4 py-3 bg-fuchsia-600 text-white rounded-lg font-semibold text-sm hover:bg-fuchsia-700 transition disabled:opacity-50 flex items-center justify-center gap-2 min-h-11"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function CampaignCard({ campaign: c, onToggle, toggling }: { campaign: Campaign; onToggle: (id: string, active: boolean) => void; toggling: string | null }) {
  const discountLabel = c.discount_type === 'percentage'
    ? `${c.discount_value}% off`
    : c.discount_type === 'fixed'
      ? `$${c.discount_value} off`
      : `${c.discount_value} month(s) free`;

  return (
    <div className={`bg-gray-900 border rounded-xl p-5 ${c.is_active ? 'border-fuchsia-700/50' : 'border-gray-800'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold">{c.name}</h3>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${c.is_active ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
              {c.is_active ? 'Active' : 'Inactive'}
            </span>
            <span className="px-2 py-0.5 bg-fuchsia-900/50 text-fuchsia-300 text-xs font-bold rounded-full">
              {discountLabel}
            </span>
          </div>
          {c.description && <p className="text-sm text-gray-500 mt-1">{c.description}</p>}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
            {c.promo_code && (
              <span className="flex items-center gap-1 font-mono text-fuchsia-400">
                <Tag className="w-3 h-3" /> {c.promo_code}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" /> {c.current_uses}{c.max_uses ? `/${c.max_uses}` : ''} used
            </span>
            {c.end_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Ends {new Date(c.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            <span>Plans: {c.plan_types.join(', ')}</span>
          </div>
        </div>
        <button
          onClick={() => onToggle(c.id, c.is_active)}
          disabled={toggling === c.id}
          className="flex items-center gap-2 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 min-h-11 shrink-0"
          aria-label={c.is_active ? 'Deactivate campaign' : 'Activate campaign'}
        >
          {toggling === c.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : c.is_active ? (
            <ToggleRight className="w-4 h-4 text-emerald-400" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          {c.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  );
}
