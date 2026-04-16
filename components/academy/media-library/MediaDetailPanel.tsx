'use client';

// components/academy/media-library/MediaDetailPanel.tsx
// Right-side detail panel for the selected media asset. Shows editable
// name, description, tag list, read-only Cloudinary metadata, and
// buttons for "See references" (loads on demand) and "Delete".

import { useEffect, useState } from 'react';
import { X, Save, Trash2, Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import type { MediaAsset, MediaAssetReference } from '@/lib/academy/media-types';

interface MediaDetailPanelProps {
  asset: MediaAsset;
  onSave: (assetId: string, updates: Partial<Pick<MediaAsset, 'name' | 'description' | 'tags'>>) => Promise<void>;
  onDelete: (assetId: string) => Promise<boolean>;
  onClose: () => void;
  fetchReferences: (assetId: string) => Promise<MediaAssetReference[]>;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MediaDetailPanel({
  asset,
  onSave,
  onDelete,
  onClose,
  fetchReferences,
}: MediaDetailPanelProps) {
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description ?? '');
  const [tagsInput, setTagsInput] = useState(asset.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [references, setReferences] = useState<MediaAssetReference[] | null>(null);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [showReferences, setShowReferences] = useState(false);

  // Reset form state when selection changes
  useEffect(() => {
    setName(asset.name);
    setDescription(asset.description ?? '');
    setTagsInput(asset.tags.join(', '));
    setReferences(null);
    setShowReferences(false);
  }, [asset.id, asset.name, asset.description, asset.tags]);

  const dirty =
    name !== asset.name ||
    description !== (asset.description ?? '') ||
    tagsInput !== asset.tags.join(', ');

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    await onSave(asset.id, {
      name: name.trim(),
      description: description.trim() || null,
      tags: parsedTags,
    });
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${asset.name}" from the media library? This does NOT delete the Cloudinary file — only the library entry.`)) {
      return;
    }
    setDeleting(true);
    await onDelete(asset.id);
    setDeleting(false);
  }

  async function toggleReferences() {
    if (showReferences) {
      setShowReferences(false);
      return;
    }
    if (references === null) {
      setReferencesLoading(true);
      const refs = await fetchReferences(asset.id);
      setReferences(refs);
      setReferencesLoading(false);
    }
    setShowReferences(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-200">Asset details</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 min-w-11 -m-2 flex items-center justify-center text-gray-400 hover:text-white transition"
          aria-label="Close details"
          title="Close"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div>
        <label htmlFor="media-name" className="block text-xs text-gray-400 mb-1">Name</label>
        <input
          id="media-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 min-h-11"
        />
      </div>

      <div>
        <label htmlFor="media-description" className="block text-xs text-gray-400 mb-1">Description (optional)</label>
        <textarea
          id="media-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Notes about this asset for your own reference"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 resize-none"
        />
      </div>

      <div>
        <label htmlFor="media-tags" className="block text-xs text-gray-400 mb-1">Tags (comma-separated)</label>
        <input
          id="media-tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="museum, chocolate, main-hall"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 min-h-11"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || saving || !name.trim()}
        className="w-full min-h-11 flex items-center justify-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
        {saving ? 'Saving…' : 'Save'}
      </button>

      <div className="border-t border-gray-800 pt-4 space-y-2 text-xs text-gray-400">
        <div className="flex justify-between gap-2">
          <span>Kind</span>
          <span className="text-gray-200">{asset.asset_kind.replace('_', ' ')}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Size</span>
          <span className="text-gray-200">{formatBytes(asset.file_size_bytes)}</span>
        </div>
        {asset.duration_seconds !== null && (
          <div className="flex justify-between gap-2">
            <span>Duration</span>
            <span className="text-gray-200">{formatDuration(asset.duration_seconds)}</span>
          </div>
        )}
        {asset.width && asset.height && (
          <div className="flex justify-between gap-2">
            <span>Dimensions</span>
            <span className="text-gray-200">{asset.width}×{asset.height}</span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span>Uploaded</span>
          <span className="text-gray-200">{new Date(asset.created_at).toLocaleDateString()}</span>
        </div>
        <a
          href={asset.secure_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-fuchsia-400 hover:text-fuchsia-300 transition"
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          Open on Cloudinary
        </a>
      </div>

      <div className="border-t border-gray-800 pt-4">
        <button
          type="button"
          onClick={toggleReferences}
          className="w-full min-h-11 flex items-center justify-between px-3 py-2 text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition"
          aria-expanded={showReferences}
        >
          <span>Lessons using this asset{references ? ` (${references.length})` : ''}</span>
          {showReferences ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
        </button>
        {showReferences && (
          <div className="mt-2 space-y-1.5">
            {referencesLoading && (
              <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Checking references…</p>
            )}
            {!referencesLoading && references && references.length === 0 && (
              <p className="text-xs text-gray-500">No lessons reference this asset.</p>
            )}
            {!referencesLoading && references && references.length > 0 && (
              <ul role="list" className="space-y-1">
                {references.map((ref) => (
                  <li key={`${ref.lesson_id}-${ref.field}`}>
                    <Link
                      href={`/dashboard/teaching/courses/${ref.course_id}`}
                      className="block text-xs text-gray-300 hover:text-fuchsia-300 bg-gray-800 hover:bg-gray-700 rounded px-2 py-1.5 transition"
                    >
                      <div className="font-medium truncate">{ref.lesson_title}</div>
                      <div className="text-gray-500 truncate">{ref.course_title} — {ref.field === 'video_360_poster_url' ? 'poster' : 'content'}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 pt-4">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="w-full min-h-11 flex items-center justify-center gap-2 px-4 py-2 border border-red-900 text-red-400 hover:bg-red-900/30 hover:text-red-300 disabled:opacity-50 rounded-lg text-sm font-medium transition"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
          {deleting ? 'Deleting…' : 'Delete from library'}
        </button>
        <p className="text-[10px] text-gray-500 mt-1 text-center">
          Removes only the library entry. The Cloudinary file itself is untouched.
        </p>
      </div>
    </div>
  );
}
