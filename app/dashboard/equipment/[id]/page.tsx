'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, Calendar, DollarSign, Plus, Heart, Share2, Globe, Lock } from 'lucide-react';
import Image from 'next/image';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';
import ValuationChart from '@/components/equipment/ValuationChart';
import EquipmentMediaGallery, { type MediaItem } from '@/components/equipment/EquipmentMediaGallery';

interface EquipmentDetail {
  id: string;
  name: string;
  category_id: string | null;
  equipment_categories: { id: string; name: string; color?: string | null } | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  warranty_expires: string | null;
  condition: string | null;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
  transaction_id: string | null;
  visibility: string | null;
  like_count: number | null;
  share_count: number | null;
}

interface Valuation {
  id: string;
  valued_at: string;
  value: number;
  source: string | null;
  notes: string | null;
}

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<EquipmentDetail | null>(null);
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Social state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  // Add valuation form
  const [showValForm, setShowValForm] = useState(false);
  const [valDate, setValDate] = useState(new Date().toISOString().split('T')[0]);
  const [valValue, setValValue] = useState('');
  const [valNotes, setValNotes] = useState('');
  const [valSaving, setValSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemRes, valRes, mediaRes, likeRes] = await Promise.all([
        offlineFetch(`/api/equipment/${id}`),
        offlineFetch(`/api/equipment/${id}/valuations`),
        offlineFetch(`/api/equipment/${id}/media`),
        offlineFetch(`/api/social/likes?entity_type=equipment&entity_id=${id}`),
      ]);
      const [itemData, valData, mediaData, likeData] = await Promise.all([
        itemRes.json(), valRes.json(), mediaRes.json(), likeRes.json(),
      ]);
      setItem(itemData.item || null);
      setValuations(valData.valuations || []);
      setMediaItems(mediaData.media || []);
      setLiked(!!likeData.liked);
      setLikeCount(likeData.like_count ?? 0);
      setShareCount(itemData.item?.share_count ?? 0);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valValue) return;
    setValSaving(true);
    try {
      const res = await offlineFetch(`/api/equipment/${id}/valuations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valued_at: valDate,
          value: Number(valValue),
          source: 'manual',
          notes: valNotes || null,
        }),
      });
      if (res.ok) {
        setShowValForm(false);
        setValValue('');
        setValNotes('');
        load();
      }
    } finally {
      setValSaving(false);
    }
  };

  const toggleVisibility = async () => {
    if (!item) return;
    const newVisibility = item.visibility === 'public' ? 'private' : 'public';
    const res = await offlineFetch(`/api/equipment/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: newVisibility }),
    });
    if (res.ok) {
      setItem({ ...item, visibility: newVisibility });
    }
  };

  const toggleLike = async () => {
    const res = await offlineFetch('/api/social/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'equipment', entity_id: id }),
    });
    if (res.ok) {
      setLiked((prev) => !prev);
      setLikeCount((prev) => liked ? prev - 1 : prev + 1);
    }
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    offlineFetch('/api/social/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'equipment', entity_id: id, platform: 'link' }),
    });
    setShareCount((prev) => prev + 1);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto py-12 text-center text-gray-400 text-sm">Loading...</div>;
  }

  if (!item) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-gray-500">Equipment not found.</p>
        <button onClick={() => router.push('/dashboard/equipment')} className="mt-3 text-sm text-fuchsia-600">
          Back to Equipment
        </button>
      </div>
    );
  }

  const purchase = Number(item.purchase_price) || 0;
  const current = Number(item.current_value) || 0;
  const diff = current - purchase;
  const diffPct = purchase > 0 ? (diff / purchase) * 100 : 0;
  const catName = item.equipment_categories?.name;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard/equipment')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Equipment
      </button>

      {/* Main info card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex gap-5">
          {/* Image */}
          <div className="w-28 h-28 rounded-xl bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
            {item.image_url ? (
              <Image src={item.image_url} alt={item.name} width={112} height={112} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-10 h-10 text-gray-300" />
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
              <div className="flex flex-wrap gap-2 shrink-0 items-center">
                {catName && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {catName}
                  </span>
                )}
                {!item.is_active && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-500">
                    Retired
                  </span>
                )}
                <button
                  onClick={toggleVisibility}
                  className={`min-h-11 min-w-11 flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    item.visibility === 'public'
                      ? 'bg-sky-50 text-sky-600 hover:bg-sky-100'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  aria-label={item.visibility === 'public' ? 'Set to private' : 'Set to public'}
                >
                  {item.visibility === 'public' ? (
                    <><Globe className="w-3.5 h-3.5" aria-hidden="true" /> Public</>
                  ) : (
                    <><Lock className="w-3.5 h-3.5" aria-hidden="true" /> Private</>
                  )}
                </button>
                <button
                  onClick={toggleLike}
                  className="min-h-11 min-w-11 flex items-center justify-center gap-1 text-sm transition"
                  aria-label={liked ? 'Unlike' : 'Like'}
                >
                  <Heart
                    className={`w-4 h-4 ${liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
                    fill={liked ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                  {likeCount > 0 && (
                    <span className={`text-xs ${liked ? 'text-red-500' : 'text-gray-500'}`}>{likeCount}</span>
                  )}
                </button>
                <div className="relative">
                  <button
                    onClick={handleShare}
                    className="min-h-11 min-w-11 flex items-center justify-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition"
                    aria-label="Share"
                  >
                    <Share2 className="w-4 h-4" aria-hidden="true" />
                    {shareCount > 0 && (
                      <span className="text-xs text-gray-500">{shareCount}</span>
                    )}
                  </button>
                  {linkCopied && (
                    <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded">
                      Link copied!
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {item.purchase_date && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">Purchased</span>
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    {new Date(item.purchase_date + 'T00:00:00').toLocaleDateString()}
                  </p>
                </div>
              )}
              {purchase > 0 && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">Paid</span>
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-gray-400" />
                    ${purchase.toLocaleString()}
                  </p>
                </div>
              )}
              {current > 0 && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">Current Value</span>
                  <p className="text-sm font-medium text-gray-700">${current.toLocaleString()}</p>
                </div>
              )}
              {purchase > 0 && current > 0 && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">Change</span>
                  <p className={`text-sm font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {diff >= 0 ? '+' : ''}{diffPct.toFixed(1)}% (${Math.abs(diff).toLocaleString()})
                  </p>
                </div>
              )}
            </div>

            {/* Extra fields */}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
              {item.serial_number && <span>S/N: {item.serial_number}</span>}
              {item.condition && <span className="capitalize">Condition: {item.condition}</span>}
              {item.warranty_expires && (
                <span>
                  Warranty: {new Date(item.warranty_expires + 'T00:00:00').toLocaleDateString()}
                </span>
              )}
            </div>

            {item.notes && (
              <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{item.notes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Media Gallery */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <EquipmentMediaGallery
          equipmentId={id}
          media={mediaItems}
          onUpdate={setMediaItems}
        />
      </div>

      {/* Value History */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Value History</h2>
          <button
            onClick={() => setShowValForm(!showValForm)}
            className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Valuation
          </button>
        </div>

        {showValForm && (
          <form onSubmit={addValuation} className="border border-gray-200 rounded-lg p-3 mb-4 space-y-2">
            <div className="flex gap-2">
              <input
                type="date"
                value={valDate}
                onChange={(e) => setValDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={valValue}
                onChange={(e) => setValValue(e.target.value)}
                placeholder="Value"
                required
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-28"
              />
              <input
                type="text"
                value={valNotes}
                onChange={(e) => setValNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={valSaving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg transition disabled:opacity-50"
              >
                {valSaving ? '...' : 'Add'}
              </button>
            </div>
          </form>
        )}

        <ValuationChart
          valuations={valuations}
          purchasePrice={item.purchase_price}
          purchaseDate={item.purchase_date}
        />

        {/* Valuation table */}
        {valuations.length > 0 && (
          <div className="mt-4 space-y-1">
            {valuations.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs">
                <span className="text-gray-500">
                  {new Date(v.valued_at + 'T00:00:00').toLocaleDateString()}
                </span>
                <span className="font-medium text-gray-700">${Number(v.value).toLocaleString()}</span>
                {v.notes && <span className="text-gray-400 truncate max-w-40">{v.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <ActivityLinker entityType="equipment" entityId={id} />
      </div>

      {/* Life Categories */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <LifeCategoryTagger entityType="equipment" entityId={id} />
      </div>
    </div>
  );
}
