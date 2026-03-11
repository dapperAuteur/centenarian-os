'use client';

// components/equipment/EquipmentMediaGallery.tsx
// Multi-media gallery for equipment: images, videos, and audio.
// Supports upload, reorder, rename, delete with Cloudinary.

import { useState, useRef } from 'react';
import { Plus, X, GripVertical, Loader2, Image as ImageIcon, Film, Mic, Play, Pause, Pencil, Check } from 'lucide-react';
import Image from 'next/image';
import { offlineFetch } from '@/lib/offline/offline-fetch';

export interface MediaItem {
  id: string;
  equipment_id: string;
  url: string;
  public_id: string | null;
  media_type: 'image' | 'video' | 'audio';
  title: string | null;
  sort_order: number;
  created_at: string;
}

interface Props {
  equipmentId: string;
  media: MediaItem[];
  onUpdate: (media: MediaItem[]) => void;
  readOnly?: boolean;
}

function detectMediaType(url: string, file?: File): 'image' | 'video' | 'audio' {
  const mime = file?.type || '';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(url)) return 'audio';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(url) || url.includes('/video/')) return 'video';
  return 'image';
}

export default function EquipmentMediaGallery({ equipmentId, media, onUpdate, readOnly = false }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!cloudName || !uploadPreset) {
      setError('Cloudinary is not configured.');
      return;
    }

    setUploading(true);
    setError(null);

    const newMedia: MediaItem[] = [];

    for (const file of Array.from(files)) {
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('upload_preset', uploadPreset);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
          { method: 'POST', body: form },
        );
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const data = await res.json();
        if (!data.secure_url) throw new Error('No URL returned');

        const mediaType = detectMediaType(data.secure_url, file);

        // Save to DB
        const saveRes = await offlineFetch(`/api/equipment/${equipmentId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: data.secure_url,
            public_id: data.public_id || null,
            media_type: mediaType,
            title: file.name.replace(/\.[^.]+$/, ''),
          }),
        });

        if (saveRes.ok) {
          const saved = await saveRes.json();
          if (saved.media) {
            newMedia.push(...(Array.isArray(saved.media) ? saved.media : [saved.media]));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }

    if (newMedia.length > 0) {
      onUpdate([...media, ...newMedia]);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function removeMedia(mediaId: string) {
    try {
      const res = await offlineFetch(`/api/equipment/${equipmentId}/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: mediaId }),
      });
      if (res.ok) {
        onUpdate(media.filter((m) => m.id !== mediaId));
        if (playingAudio === mediaId) {
          audioRef.current?.pause();
          setPlayingAudio(null);
        }
      }
    } catch { /* ignore */ }
  }

  async function saveTitle(mediaId: string) {
    try {
      await offlineFetch(`/api/equipment/${equipmentId}/media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: mediaId, title: titleDraft }),
      });
      onUpdate(media.map((m) => m.id === mediaId ? { ...m, title: titleDraft } : m));
    } catch { /* ignore */ }
    setEditingTitle(null);
    setTitleDraft('');
  }

  function handleDragStart(id: string) {
    setDragging(id);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;

    const dragIdx = media.findIndex((m) => m.id === dragging);
    const targetIdx = media.findIndex((m) => m.id === targetId);
    if (dragIdx < 0 || targetIdx < 0) return;

    const reordered = [...media];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    onUpdate(reordered);
  }

  async function handleDragEnd() {
    if (!dragging) return;
    setDragging(null);

    // Persist new order
    const reorder = media.map((m, i) => ({ id: m.id, sort_order: i }));
    try {
      await offlineFetch(`/api/equipment/${equipmentId}/media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder }),
      });
    } catch { /* ignore */ }
  }

  function toggleAudio(mediaId: string, url: string) {
    if (playingAudio === mediaId) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      audioRef.current = audio;
      setPlayingAudio(mediaId);
    }
  }

  const typeIcon = (type: string) => {
    if (type === 'video') return <Film className="w-3 h-3" />;
    if (type === 'audio') return <Mic className="w-3 h-3" />;
    return <ImageIcon className="w-3 h-3" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          Media
          {media.length > 0 && <span className="text-xs text-gray-400 font-normal">({media.length})</span>}
        </h3>
        {!readOnly && (
          <>
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1 text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              {uploading ? 'Uploading...' : 'Add Media'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              onChange={handleFiles}
              className="hidden"
            />
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {media.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          No media yet. Add photos, videos, or audio clips.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {media.map((m) => (
          <div
            key={m.id}
            draggable={!readOnly}
            onDragStart={() => handleDragStart(m.id)}
            onDragOver={(e) => handleDragOver(e, m.id)}
            onDragEnd={handleDragEnd}
            className={`group relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 transition ${
              dragging === m.id ? 'opacity-50 scale-95' : ''
            }`}
          >
            {/* Media preview */}
            {m.media_type === 'image' && (
              <div className="aspect-square relative">
                <Image
                  src={m.url}
                  alt={m.title || 'Equipment media'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
              </div>
            )}
            {m.media_type === 'video' && (
              <div className="aspect-square relative bg-gray-900 flex items-center justify-center">
                <video
                  src={m.url}
                  className="w-full h-full object-cover"
                  controls
                  preload="metadata"
                />
              </div>
            )}
            {m.media_type === 'audio' && (
              <div className="aspect-square flex flex-col items-center justify-center gap-2 bg-gray-100">
                <Mic className="w-8 h-8 text-gray-400" />
                <button
                  type="button"
                  onClick={() => toggleAudio(m.id, m.url)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-fuchsia-600 text-white rounded-full text-xs font-medium hover:bg-fuchsia-700 transition min-h-8"
                >
                  {playingAudio === m.id
                    ? <><Pause className="w-3 h-3" /> Pause</>
                    : <><Play className="w-3 h-3" /> Play</>
                  }
                </button>
              </div>
            )}

            {/* Title + type badge */}
            <div className="px-2 py-1.5 flex items-center gap-1">
              <span className="text-gray-400 shrink-0">{typeIcon(m.media_type)}</span>
              {editingTitle === m.id ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(m.id); if (e.key === 'Escape') setEditingTitle(null); }}
                    className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-0.5 min-w-0"
                  />
                  <button type="button" onClick={() => saveTitle(m.id)} className="text-emerald-600 hover:text-emerald-700 min-h-6 min-w-6 flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-600 truncate flex-1">{m.title || 'Untitled'}</span>
              )}
            </div>

            {/* Actions overlay */}
            {!readOnly && (
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => { setEditingTitle(m.id); setTitleDraft(m.title || ''); }}
                  className="w-6 h-6 bg-white/90 border border-gray-200 rounded-full flex items-center justify-center hover:bg-white transition"
                  aria-label="Rename media"
                >
                  <Pencil className="w-3 h-3 text-gray-500" />
                </button>
                <button
                  type="button"
                  onClick={() => removeMedia(m.id)}
                  className="w-6 h-6 bg-white/90 border border-gray-200 rounded-full flex items-center justify-center hover:bg-red-50 transition"
                  aria-label="Remove media"
                >
                  <X className="w-3 h-3 text-red-500" />
                </button>
              </div>
            )}

            {/* Drag handle */}
            {!readOnly && (
              <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                <GripVertical className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
