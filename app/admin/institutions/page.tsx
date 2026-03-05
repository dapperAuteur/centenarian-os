'use client';

// app/admin/institutions/page.tsx
// Admin page: manage institutions, run aggregation, create offers, generate short links.

import { useEffect, useState, useCallback } from 'react';
import {
  Building2, RefreshCw, Plus, Loader2, Link2, ExternalLink,
  ChevronDown, ChevronUp, Pencil, Trash2, Check, X, Eye, EyeOff,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface Institution {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  account_count: number;
  last_aggregated_at: string | null;
  short_link_id: string | null;
  short_link_url: string | null;
}

interface Offer {
  id: string;
  institution_id: string;
  title: string;
  slug: string;
  description: string | null;
  offer_type: string;
  details: Record<string, unknown> | null;
  expires_at: string | null;
  url: string | null;
  is_published: boolean;
  short_link_id: string | null;
  short_link_url: string | null;
}

const OFFER_TYPES = [
  { value: 'promo_apr', label: 'Promo APR' },
  { value: 'balance_transfer', label: 'Balance Transfer' },
  { value: 'cashback', label: 'Cash Back' },
  { value: 'signup_bonus', label: 'Sign-up Bonus' },
  { value: 'fee_waiver', label: 'Fee Waiver' },
  { value: 'other', label: 'Other' },
];

export default function AdminInstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [aggregating, setAggregating] = useState(false);
  const [aggregateResult, setAggregateResult] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offers, setOffers] = useState<Record<string, Offer[]>>({});
  const [showAddOffer, setShowAddOffer] = useState<string | null>(null);
  const [offerForm, setOfferForm] = useState({ title: '', slug: '', description: '', offer_type: 'promo_apr', expires_at: '', url: '' });
  const [saving, setSaving] = useState(false);
  const [linkCreating, setLinkCreating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/institutions');
      if (res.ok) setInstitutions(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAggregate = async () => {
    setAggregating(true);
    setAggregateResult(null);
    try {
      const res = await fetch('/api/institutions/aggregate', { method: 'POST' });
      const data = await res.json();
      setAggregateResult(res.ok
        ? `Aggregated ${data.aggregated} institutions from ${data.total_institutions} unique names`
        : data.error || 'Aggregation failed');
      if (res.ok) load();
    } finally {
      setAggregating(false);
    }
  };

  const loadOffers = async (institutionId: string) => {
    const res = await fetch(`/api/admin/institutions/${institutionId}/offers`);
    if (res.ok) {
      const data = await res.json();
      setOffers((prev) => ({ ...prev, [institutionId]: data }));
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!offers[id]) loadOffers(id);
    }
  };

  const handleAddOffer = async (institutionId: string) => {
    if (!offerForm.title.trim() || !offerForm.slug.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/institutions/${institutionId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerForm),
      });
      if (res.ok) {
        setShowAddOffer(null);
        setOfferForm({ title: '', slug: '', description: '', offer_type: 'promo_apr', expires_at: '', url: '' });
        loadOffers(institutionId);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (institutionId: string, offerId: string, isPublished: boolean) => {
    await fetch(`/api/admin/institutions/${institutionId}/offers/${offerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !isPublished }),
    });
    loadOffers(institutionId);
  };

  const handleDeleteOffer = async (institutionId: string, offerId: string) => {
    if (!confirm('Delete this offer?')) return;
    await fetch(`/api/admin/institutions/${institutionId}/offers/${offerId}`, { method: 'DELETE' });
    loadOffers(institutionId);
  };

  const handleCreateShortLink = async (type: 'institution' | 'offer', id: string) => {
    setLinkCreating(id);
    try {
      const res = await fetch('/api/admin/institutions/shortlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });
      if (res.ok) {
        load();
        if (expandedId) loadOffers(expandedId);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create short link');
      }
    } finally {
      setLinkCreating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-fuchsia-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-6 h-6 text-fuchsia-400" />
          Institutions
        </h1>
        <button
          onClick={handleAggregate}
          disabled={aggregating}
          className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${aggregating ? 'animate-spin' : ''}`} />
          Run Aggregation
        </button>
      </div>

      {aggregateResult && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-gray-300">
          {aggregateResult}
        </div>
      )}

      {institutions.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>No institutions yet. Run aggregation to populate from user account data.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {institutions.map((inst) => (
            <div key={inst.id} className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div>
                    <h3 className="text-white font-medium">{inst.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span>{inst.account_count} users</span>
                      <span>/institutions/{inst.slug}</span>
                      {inst.last_aggregated_at && (
                        <span>Aggregated {new Date(inst.last_aggregated_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {inst.short_link_url ? (
                    <a href={inst.short_link_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-fuchsia-400 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> {inst.short_link_url}
                    </a>
                  ) : (
                    <button
                      onClick={() => handleCreateShortLink('institution', inst.id)}
                      disabled={linkCreating === inst.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-fuchsia-400 hover:bg-gray-800 rounded transition disabled:opacity-50"
                    >
                      {linkCreating === inst.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                      Short Link
                    </button>
                  )}
                  <button
                    onClick={() => toggleExpand(inst.id)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                  >
                    {expandedId === inst.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedId === inst.id && (
                <div className="border-t border-gray-800 p-4 space-y-4">
                  {/* Offers */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-400">Offers</h4>
                    <button
                      onClick={() => setShowAddOffer(inst.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-fuchsia-400 hover:bg-gray-800 rounded transition"
                    >
                      <Plus className="w-3 h-3" /> Add Offer
                    </button>
                  </div>

                  {(offers[inst.id] ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400">No offers yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(offers[inst.id] ?? []).map((offer) => (
                        <div key={offer.id} className="flex items-center justify-between gap-3 bg-gray-800 rounded-lg p-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-medium">{offer.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${offer.is_published ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                {offer.is_published ? 'Published' : 'Draft'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {OFFER_TYPES.find((t) => t.value === offer.offer_type)?.label}
                              {offer.expires_at && ` — Expires ${offer.expires_at}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {offer.short_link_url ? (
                              <a href={offer.short_link_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-fuchsia-400 hover:underline">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <button onClick={() => handleCreateShortLink('offer', offer.id)}
                                disabled={linkCreating === offer.id}
                                className="p-1 text-gray-400 hover:text-fuchsia-400 transition disabled:opacity-50">
                                {linkCreating === offer.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                              </button>
                            )}
                            <button onClick={() => handleTogglePublish(inst.id, offer.id, offer.is_published)}
                              className="p-1 text-gray-400 hover:text-white transition">
                              {offer.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => handleDeleteOffer(inst.id, offer.id)}
                              className="p-1 text-gray-400 hover:text-red-400 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Offer Modal */}
      <Modal isOpen={!!showAddOffer} onClose={() => setShowAddOffer(null)} title="Add Offer" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Title *</label>
            <input value={offerForm.title} onChange={(e) => setOfferForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500 placeholder-gray-400" placeholder="e.g. 0% APR for 15 Months" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Slug *</label>
            <input value={offerForm.slug} onChange={(e) => setOfferForm((f) => ({ ...f, slug: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500 placeholder-gray-400" placeholder="e.g. chase-0-apr-15mo" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Type *</label>
            <select value={offerForm.offer_type} onChange={(e) => setOfferForm((f) => ({ ...f, offer_type: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
              {OFFER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Description</label>
            <textarea rows={2} value={offerForm.description} onChange={(e) => setOfferForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full mt-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Expires</label>
              <input type="date" value={offerForm.expires_at} onChange={(e) => setOfferForm((f) => ({ ...f, expires_at: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">URL</label>
              <input value={offerForm.url} onChange={(e) => setOfferForm((f) => ({ ...f, url: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500 placeholder-gray-400" placeholder="https://..." />
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-3 flex gap-3">
          <button
            onClick={() => showAddOffer && handleAddOffer(showAddOffer)}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Offer
          </button>
          <button onClick={() => setShowAddOffer(null)}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300 transition">
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
