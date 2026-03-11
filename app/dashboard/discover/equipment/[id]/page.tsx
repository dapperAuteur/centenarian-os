'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, Heart, Share2, Loader2 } from 'lucide-react';

interface PublicEquipmentItem {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  condition: string | null;
  image_url: string | null;
  notes: string | null;
  like_count: number;
  share_count: number;
  equipment_categories: { name: string; color?: string | null } | null;
  equipment_media?: { id: string; url: string; media_type: string; caption: string | null }[];
}

export default function PublicEquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<PublicEquipmentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social/public/${id}?type=equipment`);
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
        const likeRes = await fetch(`/api/social/likes?entity_type=equipment&entity_id=${id}`);
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
      body: JSON.stringify({ entity_type: 'equipment', entity_id: id }),
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
      body: JSON.stringify({ entity_type: 'equipment', entity_id: id, platform: 'link' }),
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
        <p>Equipment not found or is not public.</p>
        <Link href="/dashboard/discover" className="text-fuchsia-600 hover:underline mt-2 inline-block">
          Back to Discover
        </Link>
      </div>
    );
  }

  const catName = item.equipment_categories?.name;
  const images = (item.equipment_media || []).filter((m) => m.media_type === 'image');

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <Link href="/dashboard/discover" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition min-h-11">
        <ArrowLeft className="w-4 h-4" />
        Back to Discover
      </Link>

      {/* Main info card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex gap-5">
          {/* Image */}
          <div className="w-28 h-28 rounded-xl bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-10 h-10 text-gray-300" aria-hidden="true" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{item.name}</h1>
                {(item.brand || item.model) && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[item.brand, item.model].filter(Boolean).join(' ')}
                  </p>
                )}
              </div>
              {catName && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 shrink-0">
                  {catName}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
              {item.condition && <span className="capitalize">Condition: {item.condition}</span>}
            </div>

            {item.notes && (
              <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{item.notes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Gallery */}
      {images.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Photos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              <div key={img.id} className="rounded-lg overflow-hidden bg-gray-100 aspect-square">
                <img src={img.url} alt={img.caption || ''} className="w-full h-full object-cover" />
                {img.caption && (
                  <p className="text-xs text-gray-500 p-1.5 truncate">{img.caption}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
