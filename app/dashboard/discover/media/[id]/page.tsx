'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star, Heart, Share2, Loader2 } from 'lucide-react';

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

interface PublicMediaItem {
  id: string;
  title: string;
  creator: string | null;
  media_type: string;
  status: string;
  rating: number | null;
  genre: string[];
  tags: string[];
  cover_image_url: string | null;
  year_released: number | null;
  notes: string | null;
  like_count: number;
  share_count: number;
}

export default function PublicMediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<PublicMediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social/public/${id}?type=media`);
      if (res.ok) {
        const d = await res.json();
        setItem(d.item);
        setLikeCount(d.item?.like_count ?? 0);
        setShareCount(d.item?.share_count ?? 0);
      } else {
        setNotFound(true);
      }

      // Try to fetch like status (may fail if not logged in)
      try {
        const likeRes = await fetch(`/api/social/likes?entity_type=media_item&entity_id=${id}`);
        if (likeRes.ok) {
          const d = await likeRes.json();
          setLiked(!!d.liked);
        }
      } catch { /* not logged in */ }
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleLike = async () => {
    const res = await fetch('/api/social/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'media_item', entity_id: id }),
    });
    if (res.ok) {
      const d = await res.json();
      setLiked(d.liked);
      setLikeCount(d.like_count);
    } else if (res.status === 401) {
      router.push('/login');
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); } catch { /* ignored */ }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    await fetch('/api/social/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'media_item', entity_id: id, platform: 'link' }),
    }).catch(() => {});
    setShareCount((c) => c + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-fuchsia-600" />
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Item not found or is not public.</p>
        <Link href="/dashboard/discover" className="text-fuchsia-600 hover:underline mt-2 inline-block">
          Back to Discover
        </Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.want_to_consume;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/discover" className="p-2 rounded-lg hover:bg-gray-100 transition mt-1 min-h-11 min-w-11 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex gap-4 flex-1 min-w-0">
          {item.cover_image_url ? (
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

      {/* Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        {item.year_released && (
          <div className="text-sm">
            <span className="text-gray-400 text-xs block">Released</span>
            <span className="text-gray-900 font-medium">{item.year_released}</span>
          </div>
        )}

        {item.genre && item.genre.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.genre.map((g) => (
              <span key={g} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{g}</span>
            ))}
          </div>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span key={t} className="text-xs bg-fuchsia-50 text-fuchsia-600 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}

        {item.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{item.notes}</div>
        )}
      </div>

      {/* Social Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleLike}
            aria-label={liked ? 'Unlike' : 'Like'}
            className={`flex items-center gap-1.5 px-4 min-h-11 rounded-lg text-sm font-medium transition ${
              liked ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
          </button>
          <button
            onClick={handleShare}
            aria-label="Share"
            className="flex items-center gap-1.5 px-4 min-h-11 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition"
          >
            <Share2 className="w-4 h-4" />
            {copiedLink ? 'Copied!' : `${shareCount} Shares`}
          </button>
        </div>
      </div>
    </div>
  );
}
