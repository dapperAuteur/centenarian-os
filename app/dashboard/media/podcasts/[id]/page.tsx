'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, Loader2, Plus, X } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Episode {
  id: string;
  title: string;
  episode_number: number | null;
  season_number: number | null;
  air_date: string | null;
  description: string | null;
  show_notes: string | null;
  audio_url: string | null;
  external_url: string | null;
  duration_min: number | null;
  status: string;
  brand_id: string | null;
  created_at: string;
}

interface LinkedMedia {
  id: string;
  media_item_id: string;
  discussion_notes: string | null;
  timestamp_start: string | null;
  title: string;
  media_type: string;
  creator: string | null;
  cover_image_url: string | null;
}

interface SearchResult {
  id: string;
  title: string;
  media_type: string;
  creator: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  book: '\u{1F4D6}', tv_show: '\u{1F4FA}', movie: '\u{1F3AC}',
  video: '\u{1F4F9}', song: '\u{1F3B5}', album: '\u{1F4BF}',
  podcast: '\u{1F399}', art: '\u{1F3A8}', article: '\u{1F4F0}', other: '\u{1F4E6}',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  recorded: { label: 'Recorded', className: 'bg-amber-100 text-amber-700' },
  published: { label: 'Published', className: 'bg-green-100 text-green-700' },
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PodcastEpisodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [linkedMedia, setLinkedMedia] = useState<LinkedMedia[]>([]);
  const [loading, setLoading] = useState(true);

  // Media linker
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [epRes, mediaRes] = await Promise.all([
        offlineFetch(`/api/podcasts/${id}`),
        offlineFetch(`/api/podcasts/${id}/media`),
      ]);
      if (epRes.ok) {
        const d = await epRes.json();
        setEpisode(d.episode || null);
      }
      if (mediaRes.ok) {
        const d = await mediaRes.json();
        setLinkedMedia(d.links || []);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await offlineFetch(`/api/media?search=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const d = await res.json();
        setSearchResults((d.items || []).filter((i: SearchResult) =>
          !linkedMedia.some((l) => l.media_item_id === i.id)
        ));
      }
    } finally { setSearching(false); }
  };

  const handleLinkMedia = async (mediaItemId: string) => {
    const res = await offlineFetch(`/api/podcasts/${id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_item_id: mediaItemId }),
    });
    if (res.ok) {
      setSearchQuery('');
      setSearchResults([]);
      load();
    }
  };

  const handleUnlinkMedia = async (mediaItemId: string) => {
    await offlineFetch(`/api/podcasts/${id}/media`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_item_id: mediaItemId }),
    });
    load();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this episode?')) return;
    const res = await offlineFetch(`/api/podcasts/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/dashboard/media/podcasts');
  };

  const handleStatusChange = async (status: string) => {
    await offlineFetch(`/api/podcasts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-fuchsia-600" />
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Episode not found.</p>
        <Link href="/dashboard/media/podcasts" className="text-fuchsia-600 hover:underline mt-2 inline-block">Back</Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[episode.status] ?? STATUS_BADGE.draft;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media/podcasts" className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            {episode.episode_number != null && (
              <span className="text-xs text-gray-400 font-mono">
                {episode.season_number != null ? `S${episode.season_number}E${episode.episode_number}` : `#${episode.episode_number}`}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{episode.title}</h1>
          {episode.air_date && <p className="text-sm text-gray-500">{fmtDate(episode.air_date)}</p>}
        </div>
      </div>

      {/* Details */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        {episode.description && (
          <div>
            <span className="text-gray-400 text-xs block">Description</span>
            <p className="text-sm text-gray-700">{episode.description}</p>
          </div>
        )}
        {episode.show_notes && (
          <div>
            <span className="text-gray-400 text-xs block">Show Notes</span>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{episode.show_notes}</p>
          </div>
        )}
        {episode.duration_min && (
          <div className="text-sm">
            <span className="text-gray-400 text-xs block">Duration</span>
            <span className="text-gray-900">{episode.duration_min} min</span>
          </div>
        )}
      </div>

      {/* Status + Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {['draft', 'recorded', 'published'].map((s) => (
              <button key={s} type="button" onClick={() => handleStatusChange(s)}
                className={`px-3 min-h-11 font-medium transition capitalize ${
                  episode.status === s ? 'bg-fuchsia-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 min-h-11 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Linked Media */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Discussed Media ({linkedMedia.length})</h3>

        {/* Search to link */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search media to link..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((r) => (
                <button key={r.id} type="button"
                  onClick={() => handleLinkMedia(r.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 min-h-11">
                  <span>{TYPE_ICONS[r.media_type] ?? '\u{1F4E6}'}</span>
                  <span className="truncate">{r.title}</span>
                  {r.creator && <span className="text-xs text-gray-400 shrink-0">by {r.creator}</span>}
                  <Plus className="w-3.5 h-3.5 text-fuchsia-600 ml-auto shrink-0" />
                </button>
              ))}
            </div>
          )}
          {searching && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching...</span>}
        </div>

        {/* Linked items */}
        {linkedMedia.length === 0 ? (
          <p className="text-xs text-gray-400">No media linked yet. Search above to add items discussed in this episode.</p>
        ) : (
          <div className="space-y-2">
            {linkedMedia.map((lm) => (
              <div key={lm.id} className="flex items-center gap-3 border border-gray-100 rounded-lg p-3">
                <span className="text-lg">{TYPE_ICONS[lm.media_type] ?? '\u{1F4E6}'}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/media/${lm.media_item_id}`}
                    className="text-sm font-medium text-gray-900 hover:text-fuchsia-600 truncate block">
                    {lm.title}
                  </Link>
                  {lm.creator && <p className="text-xs text-gray-500">{lm.creator}</p>}
                  {lm.timestamp_start && <p className="text-[10px] text-gray-400">Starts at {lm.timestamp_start}</p>}
                </div>
                <button onClick={() => handleUnlinkMedia(lm.media_item_id)}
                  aria-label="Unlink media"
                  className="text-red-400 hover:text-red-600 transition min-h-6 min-w-6 flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
