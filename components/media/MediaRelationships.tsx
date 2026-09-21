'use client';

// Read-only list of a media item's relationships (episodes, tracks, sequels, etc.).
// Media moved to Stream.WitUS, so linking, unlinking, and create-and-link are gone:
// those writes return 410. Only the media item detail page uses this component.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';

const TYPE_LABELS: Record<string, { parentLabel: string; childLabel: string }> = {
  episode_of: { parentLabel: 'Show', childLabel: 'Episodes' },
  season_of: { parentLabel: 'Show', childLabel: 'Seasons' },
  track_on: { parentLabel: 'Album', childLabel: 'Tracks' },
  created_by: { parentLabel: 'Artist', childLabel: 'Works' },
  sequel_to: { parentLabel: 'Predecessor', childLabel: 'Sequels' },
  adaptation_of: { parentLabel: 'Source', childLabel: 'Adaptations' },
  related: { parentLabel: 'Related', childLabel: 'Related' },
};

const TYPE_EMOJI: Record<string, string> = {
  book: '\u{1F4D6}', tv_show: '\u{1F4FA}', movie: '\u{1F3AC}', video: '\u{1F4F9}',
  song: '\u{1F3B5}', album: '\u{1F4BF}', podcast: '\u{1F399}', art: '\u{1F3A8}',
  article: '\u{1F4F0}', other: '\u{1F4E6}',
};

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

export default function MediaRelationships({ entityId }: { entityId: string }) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Group relationships by type and direction
  const grouped = relationships.reduce<Record<string, Relationship[]>>((acc, r) => {
    const labels = TYPE_LABELS[r.relationship_type] || { parentLabel: 'Related', childLabel: 'Related' };
    const label = r.direction === 'parent' ? labels.parentLabel : labels.childLabel;
    const key = `${r.relationship_type}:${r.direction}:${label}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Relationships ({relationships.length})</h3>

      {loading && <p className="text-xs text-gray-400" role="status">Loading...</p>}

      {!loading && relationships.length === 0 && (
        <p className="text-xs text-gray-400">No relationships on this item.</p>
      )}

      {Object.entries(grouped).map(([key, rels]) => {
        const label = key.split(':')[2];
        return (
          <div key={key} className="space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
            <div className="flex flex-wrap gap-1.5" role="list" aria-label={`${label} items`}>
              {rels.map((r) => (
                r.item && (
                  <div key={r.relationship_id} role="listitem" className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm">
                    <Link href={`/dashboard/media/${r.item.id}`} className="flex items-center gap-1.5 hover:text-fuchsia-600 transition">
                      <span aria-hidden="true">{TYPE_EMOJI[r.item.media_type] || '\u{1F4E6}'}</span>
                      <span className="truncate max-w-[160px]">{r.item.title}</span>
                    </Link>
                  </div>
                )
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
