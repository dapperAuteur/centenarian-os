'use client';

// Read-only since Media moved to Stream.WitUS: shows a podcast episode and the media
// discussed in it. Status changes, delete, and link/unlink are gone because those
// writes return 410. The status still shows as the badge in the header.

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import MovedToStreamBanner from '@/components/media/MovedToStreamBanner';

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
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [linkedMedia, setLinkedMedia] = useState<LinkedMedia[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-fuchsia-600" aria-label="Loading..." />
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
        <Link href="/dashboard/media/podcasts" aria-label="Back to podcast episodes"
          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-4 h-4 text-gray-600" aria-hidden="true" />
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

      <MovedToStreamBanner />

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

      {/* Linked Media */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Discussed Media ({linkedMedia.length})</h3>

        {linkedMedia.length === 0 ? (
          <p className="text-xs text-gray-400">No media linked to this episode.</p>
        ) : (
          <div className="space-y-2">
            {linkedMedia.map((lm) => (
              <div key={lm.id} className="flex items-center gap-3 border border-gray-100 rounded-lg p-3">
                <span className="text-lg" aria-hidden="true">{TYPE_ICONS[lm.media_type] ?? '\u{1F4E6}'}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/media/${lm.media_item_id}`}
                    className="text-sm font-medium text-gray-900 hover:text-fuchsia-600 truncate block">
                    {lm.title}
                  </Link>
                  {lm.creator && <p className="text-xs text-gray-500">{lm.creator}</p>}
                  {lm.timestamp_start && <p className="text-[10px] text-gray-400">Starts at {lm.timestamp_start}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
