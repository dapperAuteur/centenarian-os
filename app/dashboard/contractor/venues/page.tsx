'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, MapPin, Building2, ChevronDown, ChevronUp, Save, X, ExternalLink, FileImage,
} from 'lucide-react';

interface Venue {
  id: string;
  label: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  schematics_url: string | null;
  knowledge_base: KnowledgeBase;
  job_count: number;
}

interface KnowledgeBase {
  parking?: string;
  load_in?: string;
  wifi?: string;
  power?: string;
  catering?: string;
  security?: string;
  custom?: { key: string; value: string }[];
}

const KB_FIELDS: { key: keyof Omit<KnowledgeBase, 'custom'>; label: string }[] = [
  { key: 'parking', label: 'Parking' },
  { key: 'load_in', label: 'Load-in / Dock' },
  { key: 'wifi', label: 'WiFi' },
  { key: 'power', label: 'Power' },
  { key: 'catering', label: 'Catering' },
  { key: 'security', label: 'Security / Check-in' },
];

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKb, setEditKb] = useState<KnowledgeBase>({});
  const [editSchematics, setEditSchematics] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/contractor/venues')
      .then((r) => r.json())
      .then((d) => setVenues(d.venues ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(venue: Venue) {
    setEditingId(venue.id);
    setEditKb(venue.knowledge_base ?? {});
    setEditSchematics(venue.schematics_url ?? '');
  }

  async function saveKb(venueId: string) {
    setSaving(true);
    const res = await fetch('/api/contractor/venues', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location_id: venueId,
        knowledge_base: editKb,
        schematics_url: editSchematics.trim() || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setEditingId(null);
      load();
    }
  }

  function updateKbField(key: keyof Omit<KnowledgeBase, 'custom'>, value: string) {
    setEditKb((prev) => ({ ...prev, [key]: value || undefined }));
  }

  function addCustomField() {
    setEditKb((prev) => ({
      ...prev,
      custom: [...(prev.custom ?? []), { key: '', value: '' }],
    }));
  }

  function updateCustomField(index: number, field: 'key' | 'value', val: string) {
    setEditKb((prev) => {
      const custom = [...(prev.custom ?? [])];
      custom[index] = { ...custom[index], [field]: val };
      return { ...prev, custom };
    });
  }

  function removeCustomField(index: number) {
    setEditKb((prev) => ({
      ...prev,
      custom: (prev.custom ?? []).filter((_, i) => i !== index),
    }));
  }

  const filtered = search
    ? venues.filter(
        (v) =>
          v.label.toLowerCase().includes(search.toLowerCase()) ||
          v.address?.toLowerCase().includes(search.toLowerCase()),
      )
    : venues;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-bold text-neutral-100">Venues</h1>
      <p className="text-sm text-neutral-500">
        Knowledge base for venues from your jobs. Add parking, WiFi, load-in details, and more.
      </p>

      <input
        type="text"
        placeholder="Search venues..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        aria-label="Search venues"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          {search ? 'No venues match your search.' : 'No venues yet. Venues appear here when you add locations to jobs.'}
        </div>
      ) : (
        <div className="space-y-3" role="list" aria-label="Venue list">
          {filtered.map((venue) => {
            const isExpanded = expandedId === venue.id;
            const isEditing = editingId === venue.id;
            const kb = venue.knowledge_base ?? {};
            const hasKb = KB_FIELDS.some((f) => kb[f.key]) || (kb.custom?.length ?? 0) > 0;

            return (
              <article
                key={venue.id}
                role="listitem"
                className="rounded-xl border border-neutral-800 bg-neutral-900"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : venue.id)}
                  className="flex w-full items-center justify-between p-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500 rounded-xl"
                  aria-expanded={isExpanded}
                  aria-label={`${venue.label} — ${venue.job_count} job${venue.job_count !== 1 ? 's' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 size={16} className="text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="font-medium text-neutral-100">{venue.label}</span>
                      <span className="text-xs text-neutral-500">
                        {venue.job_count} job{venue.job_count !== 1 ? 's' : ''}
                      </span>
                      {hasKb && (
                        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                          KB
                        </span>
                      )}
                    </div>
                    {venue.address && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                        <MapPin size={11} aria-hidden="true" />
                        {venue.address}
                      </div>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-neutral-500 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-neutral-500 shrink-0" />
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-neutral-800 p-4 space-y-4">
                    {venue.schematics_url && !isEditing && (
                      <a
                        href={venue.schematics_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
                      >
                        <FileImage size={14} aria-hidden="true" />
                        View Schematics
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    )}

                    {isEditing ? (
                      /* Edit mode */
                      <div className="space-y-3">
                        <label className="block">
                          <span className="text-xs font-medium text-neutral-400">Schematics URL</span>
                          <input
                            type="url"
                            value={editSchematics}
                            onChange={(e) => setEditSchematics(e.target.value)}
                            placeholder="https://..."
                            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                          />
                        </label>

                        {KB_FIELDS.map((f) => (
                          <label key={f.key} className="block">
                            <span className="text-xs font-medium text-neutral-400">{f.label}</span>
                            <textarea
                              value={editKb[f.key] ?? ''}
                              onChange={(e) => updateKbField(f.key, e.target.value)}
                              rows={2}
                              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
                              placeholder={`${f.label} details...`}
                            />
                          </label>
                        ))}

                        {/* Custom fields */}
                        <div>
                          <span className="text-xs font-medium text-neutral-400">Custom Fields</span>
                          {(editKb.custom ?? []).map((c, i) => (
                            <div key={i} className="mt-1 flex gap-2">
                              <input
                                type="text"
                                value={c.key}
                                onChange={(e) => updateCustomField(i, 'key', e.target.value)}
                                placeholder="Label"
                                className="w-1/3 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                aria-label={`Custom field ${i + 1} label`}
                              />
                              <input
                                type="text"
                                value={c.value}
                                onChange={(e) => updateCustomField(i, 'value', e.target.value)}
                                placeholder="Value"
                                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                aria-label={`Custom field ${i + 1} value`}
                              />
                              <button
                                onClick={() => removeCustomField(i)}
                                className="rounded-lg border border-neutral-700 p-2 text-neutral-500 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                aria-label={`Remove custom field ${i + 1}`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={addCustomField}
                            className="mt-2 text-xs text-amber-400 hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
                          >
                            + Add custom field
                          </button>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => saveKb(venue.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                          >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <div className="space-y-3">
                        {hasKb ? (
                          <dl className="space-y-2">
                            {KB_FIELDS.map(
                              (f) =>
                                kb[f.key] && (
                                  <div key={f.key}>
                                    <dt className="text-xs font-medium text-neutral-400">{f.label}</dt>
                                    <dd className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-200">
                                      {kb[f.key]}
                                    </dd>
                                  </div>
                                ),
                            )}
                            {(kb.custom ?? []).map((c, i) => (
                              <div key={i}>
                                <dt className="text-xs font-medium text-neutral-400">{c.key}</dt>
                                <dd className="mt-0.5 text-sm text-neutral-200">{c.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="text-sm text-neutral-500">No knowledge base info yet.</p>
                        )}

                        <button
                          onClick={() => startEdit(venue)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500 sm:w-auto"
                        >
                          Edit Knowledge Base
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
