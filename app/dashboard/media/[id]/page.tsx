'use client';

// Read-only since Media moved to Stream.WitUS: the status, favorite, edit, delete,
// visibility, and note controls are gone because their media writes return 410.
// Like, share, activity links, and life categories write to their own tables and stay.

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Star, Loader2, ExternalLink, Heart, Share2, Globe, Lock,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';
import MediaRelationships from '@/components/media/MediaRelationships';
import MovedToStreamBanner from '@/components/media/MovedToStreamBanner';

interface MediaItem {
  id: string;
  title: string;
  creator: string | null;
  media_type: string;
  status: string;
  rating: number | null;
  start_date: string | null;
  end_date: string | null;
  genre: string[];
  tags: string[];
  cover_image_url: string | null;
  external_url: string | null;
  current_progress: string | null;
  total_length: string | null;
  season_number: number | null;
  episode_number: number | null;
  total_seasons: number | null;
  total_episodes: number | null;
  brand_id: string | null;
  visibility: string;
  year_released: number | null;
  source_platform: string | null;
  notes: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface MediaNote {
  id: string;
  title: string | null;
  content: string;
  content_format: string;
  note_type: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  audio_url?: string | null;
  audio_public_id?: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  book: '\u{1F4D6}', tv_show: '\u{1F4FA}', movie: '\u{1F3AC}',
  video: '\u{1F4F9}', song: '\u{1F3B5}', album: '\u{1F4BF}',
  podcast: '\u{1F399}', art: '\u{1F3A8}', article: '\u{1F4F0}', other: '\u{1F4E6}',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  want_to_consume: { label: 'Want to consume', className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  dropped: { label: 'Dropped', className: 'bg-gray-100 text-gray-500' },
};

const NOTE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'quote', label: 'Quote' },
  { value: 'review', label: 'Review' },
  { value: 'podcast_prep', label: 'Podcast Prep' },
  { value: 'discussion_point', label: 'Discussion Point' },
  { value: 'spoiler', label: 'Spoiler' },
];

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [notes, setNotes] = useState<MediaNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Social state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [visibility, setVisibility] = useState('private');
  const [copiedLink, setCopiedLink] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemRes, notesRes, likeRes] = await Promise.all([
        offlineFetch(`/api/media/${id}`),
        offlineFetch(`/api/media/${id}/notes`),
        offlineFetch(`/api/social/likes?entity_type=media_item&entity_id=${id}`),
      ]);
      if (itemRes.ok) {
        const d = await itemRes.json();
        setItem(d.item || null);
        setShareCount(d.item?.share_count ?? 0);
        setVisibility(d.item?.visibility ?? 'private');
      }
      if (notesRes.ok) {
        const d = await notesRes.json();
        setNotes(d.notes || []);
      }
      if (likeRes.ok) {
        const d = await likeRes.json();
        setLiked(!!d.liked);
        setLikeCount(d.like_count ?? 0);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleLike = async () => {
    const res = await offlineFetch('/api/social/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'media_item', entity_id: id }),
    });
    if (res.ok) {
      const d = await res.json();
      setLiked(d.liked);
      setLikeCount(d.like_count);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/dashboard/discover/media/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch { /* fallback ignored */ }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    await offlineFetch('/api/social/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'media_item', entity_id: id, platform: 'link' }),
    });
    setShareCount((c) => c + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-fuchsia-600" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Item not found.</p>
        <Link href="/dashboard/media" className="text-fuchsia-600 hover:underline mt-2 inline-block">Back to media</Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.want_to_consume;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/media" aria-label="Back to media"
          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-4 h-4 text-gray-600" aria-hidden="true" />
        </Link>
        <div className="flex gap-4 flex-1 min-w-0">
          {item.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.cover_image_url} alt="" className="w-20 h-28 object-cover rounded-lg shrink-0 bg-gray-100" />
          ) : (
            <div className="w-20 h-28 bg-gray-100 rounded-lg flex items-center justify-center text-3xl shrink-0">
              {TYPE_ICONS[item.media_type] ?? '\u{1F4E6}'}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
              <span className="text-xs text-gray-400 capitalize">{item.media_type.replace('_', ' ')}</span>
              {item.is_favorite && <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>
            {item.creator && <p className="text-sm text-gray-500 mt-0.5">{item.creator}</p>}
            {item.rating != null && (
              <div className="flex items-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`w-4 h-4 ${n <= item.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <MovedToStreamBanner />

      {/* Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {item.start_date && (
            <div>
              <span className="text-gray-400 text-xs block">Started</span>
              <span className="text-gray-900 font-medium">{fmtDate(item.start_date)}</span>
            </div>
          )}
          {item.end_date && (
            <div>
              <span className="text-gray-400 text-xs block">Finished</span>
              <span className="text-gray-900 font-medium">{fmtDate(item.end_date)}</span>
            </div>
          )}
          {item.year_released && (
            <div>
              <span className="text-gray-400 text-xs block">Released</span>
              <span className="text-gray-900 font-medium">{item.year_released}</span>
            </div>
          )}
        </div>

        {(item.current_progress || item.total_length) && (
          <div className="text-sm">
            <span className="text-gray-400 text-xs block">Progress</span>
            <span className="text-gray-900">{item.current_progress ?? '—'}{item.total_length ? ` / ${item.total_length}` : ''}</span>
          </div>
        )}

        {(item.season_number != null || item.episode_number != null) && (
          <div className="flex gap-4 text-sm">
            {item.season_number != null && (
              <div>
                <span className="text-gray-400 text-xs block">Season</span>
                <span className="text-gray-900">{item.season_number}{item.total_seasons ? ` / ${item.total_seasons}` : ''}</span>
              </div>
            )}
            {item.episode_number != null && (
              <div>
                <span className="text-gray-400 text-xs block">Episode</span>
                <span className="text-gray-900">{item.episode_number}{item.total_episodes ? ` / ${item.total_episodes}` : ''}</span>
              </div>
            )}
          </div>
        )}

        {item.genre.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.genre.map((g) => (
              <span key={g} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{g}</span>
            ))}
          </div>
        )}

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span key={t} className="text-xs bg-fuchsia-50 text-fuchsia-600 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}

        {item.source_platform && (
          <div className="text-sm">
            <span className="text-gray-400 text-xs block">Platform</span>
            <span className="text-gray-900">{item.source_platform}</span>
          </div>
        )}

        {item.external_url && (
          <a href={item.external_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> View on external site
          </a>
        )}

        {item.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{item.notes}</div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          {/* Visibility is display-only now; changing it was a media write. */}
          <span
            className={`flex items-center gap-1.5 px-3 min-h-11 rounded-lg text-sm font-medium ${
              visibility === 'public' ? 'bg-fuchsia-50 text-fuchsia-700' : 'bg-gray-50 text-gray-600'
            }`}>
            {visibility === 'public'
              ? <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              : <Lock className="w-3.5 h-3.5" aria-hidden="true" />}
            {visibility === 'public' ? 'Public' : 'Private'}
          </span>
          <button onClick={handleLike}
            aria-label={liked ? 'Unlike' : 'Like'}
            className={`flex items-center gap-1.5 px-3 min-h-11 rounded-lg text-sm font-medium transition ${
              liked ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}>
            <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
            {likeCount}
          </button>
          <button onClick={handleShare}
            aria-label="Share"
            className="flex items-center gap-1.5 px-3 min-h-11 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition">
            <Share2 className="w-3.5 h-3.5" />
            {copiedLink ? 'Copied!' : shareCount}
          </button>
        </div>
      </div>

      {/* Relationships */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <MediaRelationships entityId={item.id} />
      </div>

      {/* Notes */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Notes ({notes.length})</h3>

        {notes.length === 0 && (
          <p className="text-xs text-gray-400">No notes on this item.</p>
        )}

        {notes.map((note) => {
          const typeLabel = NOTE_TYPES.find((t) => t.value === note.note_type)?.label ?? note.note_type;
          return (
            <div key={note.id} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                {note.title && <span className="text-sm font-medium text-gray-900">{note.title}</span>}
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{typeLabel}</span>
              </div>
              {note.content && <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>}
              {note.audio_url && (
                <audio src={note.audio_url} controls className="h-10 w-full mt-2" />
              )}
              <span className="text-[10px] text-gray-400 mt-1 block">{fmtDate(note.created_at?.split('T')[0])}</span>
            </div>
          );
        })}
      </div>

      {/* Activity Links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <ActivityLinker entityType="media_item" entityId={item.id} />
      </div>

      {/* Life Categories */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <LifeCategoryTagger entityType="media_item" entityId={item.id} />
      </div>
    </div>
  );
}
