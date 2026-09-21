'use client';

// Read-only since Media moved to Stream.WitUS: lists podcast episodes. The New Episode
// form is gone because POST /api/podcasts returns 410.

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  status: string;
  duration_min: number | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  recorded: { label: 'Recorded', className: 'bg-amber-100 text-amber-700' },
  published: { label: 'Published', className: 'bg-green-100 text-green-700' },
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PodcastEpisodesPage() {
  const router = useRouter();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const epRes = await offlineFetch('/api/podcasts');
      if (epRes.ok) {
        const d = await epRes.json();
        setEpisodes(d.episodes || []);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media" aria-label="Back to media"
          className="min-h-11 min-w-11 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Podcast Episodes</h1>
          <p className="text-sm text-gray-500">{episodes.length} episodes</p>
        </div>
      </div>

      <MovedToStreamBanner />

      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="animate-spin h-6 w-6 text-fuchsia-600" aria-label="Loading..." />
        </div>
      ) : episodes.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">No episodes.</div>
      ) : (
        <div className="space-y-2">
          {episodes.map((ep) => {
            const badge = STATUS_BADGE[ep.status] ?? STATUS_BADGE.draft;
            return (
              <button key={ep.id} type="button"
                onClick={() => router.push(`/dashboard/media/podcasts/${ep.id}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-fuchsia-300 hover:shadow-sm transition">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {ep.episode_number != null && (
                        <span className="text-xs text-gray-400 font-mono">
                          {ep.season_number != null ? `S${ep.season_number}E${ep.episode_number}` : `#${ep.episode_number}`}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.className}`}>{badge.label}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{ep.title}</h3>
                    {ep.air_date && <p className="text-xs text-gray-500 mt-0.5">{fmtDate(ep.air_date)}</p>}
                  </div>
                  {ep.duration_min && (
                    <span className="text-xs text-gray-400 shrink-0">{ep.duration_min} min</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
