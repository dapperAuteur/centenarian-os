'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, X, Search, Loader2, FilePlus } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import MediaForm from './MediaForm';

const TYPE_LABELS: Record<string, { parentLabel: string; childLabel: string }> = {
  episode_of: { parentLabel: 'Show', childLabel: 'Episodes' },
  season_of: { parentLabel: 'Show', childLabel: 'Seasons' },
  track_on: { parentLabel: 'Album', childLabel: 'Tracks' },
  created_by: { parentLabel: 'Artist', childLabel: 'Works' },
  sequel_to: { parentLabel: 'Predecessor', childLabel: 'Sequels' },
  adaptation_of: { parentLabel: 'Source', childLabel: 'Adaptations' },
  related: { parentLabel: 'Related', childLabel: 'Related' },
};

const RELATIONSHIP_TYPES = [
  { value: 'episode_of', label: 'Episode of' },
  { value: 'season_of', label: 'Season of' },
  { value: 'track_on', label: 'Track on' },
  { value: 'created_by', label: 'Created by' },
  { value: 'sequel_to', label: 'Sequel to' },
  { value: 'adaptation_of', label: 'Adaptation of' },
  { value: 'related', label: 'Related' },
];

const TYPE_EMOJI: Record<string, string> = {
  book: '\u{1F4D6}', tv_show: '\u{1F4FA}', movie: '\u{1F3AC}', video: '\u{1F4F9}',
  song: '\u{1F3B5}', album: '\u{1F4BF}', podcast: '\u{1F399}', art: '\u{1F3A8}',
  article: '\u{1F4F0}', other: '\u{1F4E6}',
};

/** Suggest a default media type for the new related item based on relationship type + direction */
function suggestMediaType(relType: string, direction: 'parent' | 'child'): string | undefined {
  if (relType === 'episode_of') return direction === 'child' ? 'tv_show' : 'tv_show';
  if (relType === 'season_of') return direction === 'child' ? 'tv_show' : 'tv_show';
  if (relType === 'track_on') return direction === 'child' ? 'album' : 'song';
  return undefined;
}

interface RelatedItem {
  id: string;
  title: string;
  media_type: string;
  cover_image_url: string | null;
}

interface Relationship {
  relationship_id: string;
  relationship_type: string;
  direction: 'parent' | 'child';
  sort_order: number;
  item: RelatedItem | null;
}

interface SearchResult {
  id: string;
  title: string;
  media_type: string;
  cover_image_url: string | null;
}

export default function MediaRelationships({ entityId }: { entityId: string }) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [relType, setRelType] = useState('related');
  const [direction, setDirection] = useState<'parent' | 'child'>('child');
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brandsLoaded, setBrandsLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/media/${entityId}/relationships`);
      if (res.ok) {
        const d = await res.json();
        setRelationships(d.relationships || []);
      }
    } catch { /* offline cache miss */ }
    finally { setLoading(false); }
  }, [entityId]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await offlineFetch(`/api/media?search=${encodeURIComponent(search.trim())}&limit=10`);
        if (res.ok) {
          const d = await res.json();
          setResults((d.items || []).filter((i: SearchResult) => i.id !== entityId));
        }
      } catch { /* offline cache miss */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, entityId]);

  // Lazy-load brands only when create form is opened
  const loadBrands = useCallback(async () => {
    if (brandsLoaded) return;
    try {
      const res = await offlineFetch('/api/brands');
      if (res.ok) {
        const d = await res.json();
        setBrands(d.brands || d || []);
      }
    } catch { /* offline — brands optional */ }
    setBrandsLoaded(true);
  }, [brandsLoaded]);

  const handleAdd = async (relatedId: string) => {
    setSaving(true);
    try {
      const res = await offlineFetch(`/api/media/${entityId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ related_id: relatedId, relationship_type: relType, direction }),
      });
      if (res.ok) {
        setSearch('');
        setResults([]);
        load();
      }
    } finally { setSaving(false); }
  };

  const handleRemove = async (relationshipId: string) => {
    await offlineFetch(`/api/media/${entityId}/relationships?relationship_id=${relationshipId}`, {
      method: 'DELETE',
    });
    load();
  };

  const handleOpenCreate = () => {
    loadBrands();
    setShowCreateForm(true);
  };

  const handleCreatedAndLink = async (createdItem?: { id: string; title: string; media_type: string }) => {
    if (!createdItem) {
      load();
      return;
    }
    // Auto-link the newly created item
    try {
      await offlineFetch(`/api/media/${entityId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          related_id: createdItem.id,
          relationship_type: relType,
          direction,
        }),
      });
    } catch { /* will sync later if offline */ }
    load();
  };

  // Group relationships by type and direction
  const grouped = relationships.reduce<Record<string, Relationship[]>>((acc, r) => {
    const labels = TYPE_LABELS[r.relationship_type] || { parentLabel: 'Related', childLabel: 'Related' };
    const label = r.direction === 'parent' ? labels.parentLabel : labels.childLabel;
    const key = `${r.relationship_type}:${r.direction}:${label}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const suggestedType = suggestMediaType(relType, direction);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Relationships ({relationships.length})</h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium min-h-11"
          aria-expanded={showAdd}
          aria-controls="relationship-add-panel"
        >
          {showAdd ? <X className="w-3.5 h-3.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
          {showAdd ? 'Close' : 'Link'}
        </button>
      </div>

      {showAdd && (
        <div id="relationship-add-panel" className="border border-gray-200 rounded-lg p-3 space-y-2" role="region" aria-label="Add relationship">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={relType}
              onChange={(e) => setRelType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-11"
              aria-label="Relationship type"
            >
              {RELATIONSHIP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'parent' | 'child')}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-11"
              aria-label="Direction"
            >
              <option value="child">This item is the parent</option>
              <option value="parent">This item is the child</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your media..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm min-h-11"
              aria-label="Search media to link"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" aria-hidden="true" />}
          </div>
          {results.length > 0 && (
            <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50" role="list" aria-label="Search results">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleAdd(r.id)}
                  disabled={saving}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition min-h-11"
                  role="listitem"
                >
                  <span aria-hidden="true">{TYPE_EMOJI[r.media_type] || '\u{1F4E6}'}</span>
                  <span className="truncate flex-1">{r.title}</span>
                  <span className="text-[10px] text-gray-400">{r.media_type}</span>
                </button>
              ))}
            </div>
          )}
          {/* Create & Link button */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-fuchsia-600 border border-dashed border-fuchsia-300 rounded-lg hover:bg-fuchsia-50 transition min-h-11"
            aria-label="Create new media item and link it"
          >
            <FilePlus className="w-4 h-4" aria-hidden="true" />
            Create &amp; Link New Item
          </button>
        </div>
      )}

      {loading && <p className="text-xs text-gray-400" role="status">Loading...</p>}

      {!loading && relationships.length === 0 && !showAdd && (
        <p className="text-xs text-gray-400">No relationships yet. Link episodes, tracks, sequels, or artists.</p>
      )}

      {Object.entries(grouped).map(([key, rels]) => {
        const label = key.split(':')[2];
        return (
          <div key={key} className="space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
            <div className="flex flex-wrap gap-1.5" role="list" aria-label={`${label} items`}>
              {rels.map((r) => (
                r.item && (
                  <div key={r.relationship_id} role="listitem" className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg pl-2 pr-1 py-1 text-sm group">
                    <Link href={`/dashboard/media/${r.item.id}`} className="flex items-center gap-1.5 hover:text-fuchsia-600 transition">
                      <span aria-hidden="true">{TYPE_EMOJI[r.item.media_type] || '\u{1F4E6}'}</span>
                      <span className="truncate max-w-[160px]">{r.item.title}</span>
                    </Link>
                    <button
                      onClick={() => handleRemove(r.relationship_id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition min-h-6 min-w-6 flex items-center justify-center"
                      aria-label={`Remove relationship with ${r.item.title}`}
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                )
              ))}
            </div>
          </div>
        );
      })}

      {/* Inline create form */}
      <MediaForm
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSaved={handleCreatedAndLink}
        brands={brands}
        prefill={suggestedType ? { media_type: suggestedType } : null}
      />
    </div>
  );
}
