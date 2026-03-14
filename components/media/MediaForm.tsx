'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

const MEDIA_TYPES = [
  { value: 'book', label: 'Book', icon: '\u{1F4D6}' },
  { value: 'tv_show', label: 'TV Show', icon: '\u{1F4FA}' },
  { value: 'movie', label: 'Movie', icon: '\u{1F3AC}' },
  { value: 'video', label: 'Video', icon: '\u{1F4F9}' },
  { value: 'song', label: 'Song', icon: '\u{1F3B5}' },
  { value: 'album', label: 'Album', icon: '\u{1F4BF}' },
  { value: 'podcast', label: 'Podcast', icon: '\u{1F399}' },
  { value: 'art', label: 'Art', icon: '\u{1F3A8}' },
  { value: 'article', label: 'Article', icon: '\u{1F4F0}' },
  { value: 'other', label: 'Other', icon: '\u{1F4E6}' },
];

const STATUS_OPTIONS = [
  { value: 'want_to_consume', label: 'Want to consume' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
];

interface Brand {
  id: string;
  name: string;
}

export interface MediaPrefill {
  title?: string;
  creator?: string | null;
  media_type?: string;
  year_released?: number | null;
  cover_image_url?: string | null;
  genre?: string[];
  notes?: string | null;
  external_url?: string;
}

interface MediaFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (createdItem?: { id: string; title: string; media_type: string }) => void;
  brands: Brand[];
  prefill?: MediaPrefill | null;
  editItem?: {
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
    external_url?: string | null;
    current_progress: string | null;
    total_length: string | null;
    season_number: number | null;
    episode_number: number | null;
    total_seasons?: number | null;
    total_episodes?: number | null;
    brand_id?: string | null;
    visibility: string;
    year_released: number | null;
    source_platform: string | null;
    notes?: string | null;
    is_favorite: boolean;
  } | null;
}

const BLANK = {
  title: '',
  creator: '',
  media_type: 'book',
  status: 'want_to_consume',
  rating: '',
  start_date: '',
  end_date: '',
  genre: '',
  tags: '',
  cover_image_url: '',
  external_url: '',
  current_progress: '',
  total_length: '',
  season_number: '',
  episode_number: '',
  total_seasons: '',
  total_episodes: '',
  brand_id: '',
  visibility: 'private',
  year_released: '',
  source_platform: '',
  notes: '',
  is_favorite: false,
};

export default function MediaForm({ isOpen, onClose, onSaved, brands, prefill, editItem }: MediaFormProps) {
  const isEdit = !!editItem;
  const [form, setForm] = useState(() => {
    if (!editItem && prefill) {
      return {
        ...BLANK,
        title: prefill.title ?? '',
        creator: prefill.creator ?? '',
        media_type: prefill.media_type ?? 'book',
        year_released: prefill.year_released != null ? String(prefill.year_released) : '',
        cover_image_url: prefill.cover_image_url ?? '',
        genre: (prefill.genre ?? []).join('; '),
        notes: prefill.notes ?? '',
        external_url: prefill.external_url ?? '',
      };
    }
    if (!editItem) return { ...BLANK };
    return {
      title: editItem.title,
      creator: editItem.creator ?? '',
      media_type: editItem.media_type,
      status: editItem.status,
      rating: editItem.rating != null ? String(editItem.rating) : '',
      start_date: editItem.start_date ?? '',
      end_date: editItem.end_date ?? '',
      genre: (editItem.genre ?? []).join('; '),
      tags: (editItem.tags ?? []).join('; '),
      cover_image_url: editItem.cover_image_url ?? '',
      external_url: editItem.external_url ?? '',
      current_progress: editItem.current_progress ?? '',
      total_length: editItem.total_length ?? '',
      season_number: editItem.season_number != null ? String(editItem.season_number) : '',
      episode_number: editItem.episode_number != null ? String(editItem.episode_number) : '',
      total_seasons: editItem.total_seasons != null ? String(editItem.total_seasons) : '',
      total_episodes: editItem.total_episodes != null ? String(editItem.total_episodes) : '',
      brand_id: editItem.brand_id ?? '',
      visibility: editItem.visibility ?? 'private',
      year_released: editItem.year_released != null ? String(editItem.year_released) : '',
      source_platform: editItem.source_platform ?? '',
      notes: editItem.notes ?? '',
      is_favorite: editItem.is_favorite,
    };
  });
  const [saving, setSaving] = useState(false);

  const isTv = form.media_type === 'tv_show';
  const isBook = form.media_type === 'book';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...(isEdit ? { id: editItem!.id } : {}),
        title: form.title.trim(),
        creator: form.creator.trim() || null,
        media_type: form.media_type,
        status: form.status,
        rating: form.rating ? parseInt(form.rating) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        genre: form.genre ? form.genre.split(';').map((s: string) => s.trim()).filter(Boolean) : [],
        tags: form.tags ? form.tags.split(';').map((s: string) => s.trim()).filter(Boolean) : [],
        cover_image_url: form.cover_image_url.trim() || null,
        external_url: form.external_url.trim() || null,
        current_progress: form.current_progress.trim() || null,
        total_length: form.total_length.trim() || null,
        season_number: form.season_number ? parseInt(form.season_number) : null,
        episode_number: form.episode_number ? parseInt(form.episode_number) : null,
        total_seasons: form.total_seasons ? parseInt(form.total_seasons) : null,
        total_episodes: form.total_episodes ? parseInt(form.total_episodes) : null,
        brand_id: form.brand_id || null,
        visibility: form.visibility,
        year_released: form.year_released ? parseInt(form.year_released) : null,
        source_platform: form.source_platform.trim() || null,
        notes: form.notes.trim() || null,
        is_favorite: form.is_favorite,
      };

      const url = isEdit ? `/api/media/${editItem!.id}` : '/api/media';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const created = !isEdit && data?.item
          ? { id: data.item.id, title: data.item.title, media_type: data.item.media_type }
          : undefined;
        onSaved(created);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Media' : 'Add Media'} size="sm">
      <form onSubmit={handleSave}>
        <div className="p-6 space-y-4">
          {/* Media type selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {MEDIA_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, media_type: t.value }))}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition min-h-11 ${
                    form.media_type === t.value
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="media-title" className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              id="media-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              required
              aria-required="true"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="media-creator" className="block text-xs font-medium text-gray-600 mb-1">
                {isBook ? 'Author' : isTv ? 'Network / Creator' : 'Creator / Artist'}
              </label>
              <input
                id="media-creator"
                type="text"
                value={form.creator}
                onChange={(e) => setForm((f) => ({ ...f, creator: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="media-status" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                id="media-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, rating: f.rating === String(n) ? '' : String(n) }))}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                    form.rating && parseInt(form.rating) >= n
                      ? 'bg-amber-400 text-white'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                  aria-label={`Rate ${n} stars`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="media-start" className="block text-xs font-medium text-gray-600 mb-1">Started</label>
              <input
                id="media-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="media-end" className="block text-xs font-medium text-gray-600 mb-1">Finished</label>
              <input
                id="media-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* TV-specific fields */}
          {isTv && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label htmlFor="media-season" className="block text-xs font-medium text-gray-600 mb-1">Season</label>
                <input id="media-season" type="number" value={form.season_number}
                  onChange={(e) => setForm((f) => ({ ...f, season_number: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="media-episode" className="block text-xs font-medium text-gray-600 mb-1">Episode</label>
                <input id="media-episode" type="number" value={form.episode_number}
                  onChange={(e) => setForm((f) => ({ ...f, episode_number: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="media-total-seasons" className="block text-xs font-medium text-gray-600 mb-1">Total S</label>
                <input id="media-total-seasons" type="number" value={form.total_seasons}
                  onChange={(e) => setForm((f) => ({ ...f, total_seasons: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="media-total-episodes" className="block text-xs font-medium text-gray-600 mb-1">Total Ep</label>
                <input id="media-total-episodes" type="number" value={form.total_episodes}
                  onChange={(e) => setForm((f) => ({ ...f, total_episodes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" />
              </div>
            </div>
          )}

          {/* Progress tracking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="media-progress" className="block text-xs font-medium text-gray-600 mb-1">
                Progress {isBook ? '(page)' : isTv ? '(episode)' : ''}
              </label>
              <input id="media-progress" type="text" value={form.current_progress}
                placeholder={isBook ? 'Page 142' : isTv ? 'S2E7' : 'Current'}
                onChange={(e) => setForm((f) => ({ ...f, current_progress: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="media-total" className="block text-xs font-medium text-gray-600 mb-1">Total Length</label>
              <input id="media-total" type="text" value={form.total_length}
                placeholder={isBook ? '384 pages' : '2h 15m'}
                onChange={(e) => setForm((f) => ({ ...f, total_length: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="media-genre" className="block text-xs font-medium text-gray-600 mb-1">Genre (semicolon-separated)</label>
              <input id="media-genre" type="text" value={form.genre} placeholder="Drama; Sci-Fi"
                onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="media-tags" className="block text-xs font-medium text-gray-600 mb-1">Tags (semicolon-separated)</label>
              <input id="media-tags" type="text" value={form.tags} placeholder="podcast-worthy; favorite"
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="media-year" className="block text-xs font-medium text-gray-600 mb-1">Year</label>
              <input id="media-year" type="number" value={form.year_released}
                onChange={(e) => setForm((f) => ({ ...f, year_released: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="media-platform" className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
              <input id="media-platform" type="text" value={form.source_platform} placeholder="Netflix, Kindle..."
                onChange={(e) => setForm((f) => ({ ...f, source_platform: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            {brands.length > 0 && (
              <div>
                <label htmlFor="media-brand" className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                <select id="media-brand" value={form.brand_id}
                  onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">None</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="media-url" className="block text-xs font-medium text-gray-600 mb-1">External URL (IMDB, Goodreads, etc.)</label>
            <input id="media-url" type="url" value={form.external_url} placeholder="https://..."
              onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label htmlFor="media-cover" className="block text-xs font-medium text-gray-600 mb-1">Cover Image URL</label>
            <input id="media-cover" type="url" value={form.cover_image_url} placeholder="https://..."
              onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label htmlFor="media-notes" className="block text-xs font-medium text-gray-600 mb-1">Quick Notes</label>
            <textarea id="media-notes" value={form.notes} rows={2} placeholder="Initial thoughts..."
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_favorite}
              onChange={(e) => setForm((f) => ({ ...f, is_favorite: e.target.checked }))}
              className="rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
            <span className="text-xs font-medium text-gray-600">Mark as favorite</span>
          </label>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 pt-3 pb-3 flex flex-col sm:flex-row gap-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl min-h-11 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-fuchsia-600 text-white rounded-xl min-h-11 text-sm font-medium hover:bg-fuchsia-700 transition disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Media'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
