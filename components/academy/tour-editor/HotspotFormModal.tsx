'use client';

// components/academy/tour-editor/HotspotFormModal.tsx
// Create-or-edit modal for a single hotspot. Fields are type-aware:
//   info:       title, body
//   audio:      title, body, audio_url
//   link:       title, body, external_url
//   scene_jump: title, target_scene_slug

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { EditorHotspot, EditorScene } from './TourEditor';
import type { HotspotType } from '@/lib/academy/tour-types';

interface HotspotFormModalProps {
  initial: EditorHotspot | null;
  /** Pre-fill yaw/pitch when creating a new hotspot (from the preview's "Place hotspot here" button). */
  initialPosition?: { yaw: number; pitch: number };
  allScenes: EditorScene[];
  onSave: (hotspot: EditorHotspot) => void;
  onCancel: () => void;
}

const DEFAULT_HOTSPOT: Omit<EditorHotspot, 'local_id'> = {
  hotspot_type: 'info',
  yaw: 0,
  pitch: 0,
  title: '',
  body: '',
  audio_url: null,
  external_url: null,
  target_scene_slug: null,
  icon: 'info',
};

// PSV expresses angles in radians. Yaw: full horizontal rotation (0 to 2π
// or -π to π — we accept either). Pitch: vertical, clamped to ±π/2.
const PITCH_MIN = -Math.PI / 2;
const PITCH_MAX = Math.PI / 2;
const YAW_MIN = -Math.PI * 2;
const YAW_MAX = Math.PI * 2;

export default function HotspotFormModal({ initial, initialPosition, allScenes, onSave, onCancel }: HotspotFormModalProps) {
  const [state, setState] = useState<EditorHotspot>(() => {
    if (initial) return initial;
    return {
      ...DEFAULT_HOTSPOT,
      local_id: crypto.randomUUID(),
      ...(initialPosition ? { yaw: initialPosition.yaw, pitch: initialPosition.pitch } : {}),
    };
  });
  const [error, setError] = useState<string | null>(null);

  // Close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function update<K extends keyof EditorHotspot>(key: K, value: EditorHotspot[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (state.hotspot_type === 'audio' && !state.audio_url?.trim()) {
      setError('Audio hotspots need an audio URL.');
      return;
    }
    if (state.hotspot_type === 'link' && !state.external_url?.trim()) {
      setError('Link hotspots need an external URL.');
      return;
    }
    if (state.hotspot_type === 'scene_jump' && !state.target_scene_slug) {
      setError('Scene-jump hotspots need a target scene.');
      return;
    }
    onSave({
      ...state,
      title: state.title.trim(),
      body: state.body?.trim() || null,
      audio_url: state.audio_url?.trim() || null,
      external_url: state.external_url?.trim() || null,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hotspot-modal-title"
      // Dock to the right on desktop (doesn't cover the scene preview on
      // the left), full-screen modal on mobile. Backdrop is transparent on
      // desktop so the preview stays interactive behind; opaque on mobile.
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/70 sm:bg-black/20 dark-input"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border-t sm:border-t-0 sm:border-l border-gray-700 rounded-t-2xl sm:rounded-none w-full sm:w-96 sm:h-full overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 id="hotspot-modal-title" className="text-base font-semibold text-white">
            {initial ? 'Edit hotspot' : 'Add hotspot'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 min-w-11 -m-2 flex items-center justify-center text-gray-400 hover:text-white"
            aria-label="Close hotspot form"
            title="Close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="hotspot-type" className="block text-xs text-gray-400 mb-1">Type</label>
            <select
              id="hotspot-type"
              value={state.hotspot_type}
              onChange={(e) => update('hotspot_type', e.target.value as HotspotType)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
            >
              <option value="info">Info — shows a text panel</option>
              <option value="audio">Audio — plays a sound clip</option>
              <option value="link">Link — opens an external URL</option>
              <option value="scene_jump">Scene jump — moves to another scene</option>
            </select>
          </div>

          <div>
            <label htmlFor="hotspot-title" className="block text-xs text-gray-400 mb-1">Title *</label>
            <input
              id="hotspot-title"
              type="text"
              value={state.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="Shown as the hotspot tooltip + panel heading"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500 min-h-11"
              required
            />
          </div>

          <div>
            <label htmlFor="hotspot-body" className="block text-xs text-gray-400 mb-1">Body (optional)</label>
            <textarea
              id="hotspot-body"
              value={state.body ?? ''}
              onChange={(e) => update('body', e.target.value)}
              placeholder="Longer description shown inside the panel"
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500 resize-none"
            />
          </div>

          {state.hotspot_type === 'audio' && (
            <div>
              <label htmlFor="hotspot-audio" className="block text-xs text-gray-400 mb-1">Audio URL *</label>
              <input
                id="hotspot-audio"
                type="url"
                value={state.audio_url ?? ''}
                onChange={(e) => update('audio_url', e.target.value || null)}
                placeholder="https://…/clip.mp3"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500 min-h-11"
              />
            </div>
          )}

          {state.hotspot_type === 'link' && (
            <div>
              <label htmlFor="hotspot-link" className="block text-xs text-gray-400 mb-1">External URL *</label>
              <input
                id="hotspot-link"
                type="url"
                value={state.external_url ?? ''}
                onChange={(e) => update('external_url', e.target.value || null)}
                placeholder="https://…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500 min-h-11"
              />
            </div>
          )}

          {state.hotspot_type === 'scene_jump' && (
            <div>
              <label htmlFor="hotspot-target" className="block text-xs text-gray-400 mb-1">Target scene *</label>
              <select
                id="hotspot-target"
                value={state.target_scene_slug ?? ''}
                onChange={(e) => update('target_scene_slug', e.target.value || null)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
              >
                <option value="">— Select a scene —</option>
                {allScenes.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="hotspot-yaw" className="block text-xs text-gray-400 mb-1">
                Yaw <span className="text-gray-500">(−6.28 to 6.28)</span>
              </label>
              <input
                id="hotspot-yaw"
                type="number"
                step="0.01"
                min={YAW_MIN}
                max={YAW_MAX}
                value={state.yaw}
                onChange={(e) => update('yaw', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
              />
            </div>
            <div>
              <label htmlFor="hotspot-pitch" className="block text-xs text-gray-400 mb-1">
                Pitch <span className="text-gray-500">(−1.57 to 1.57)</span>
              </label>
              <input
                id="hotspot-pitch"
                type="number"
                step="0.01"
                min={PITCH_MIN}
                max={PITCH_MAX}
                value={state.pitch}
                onChange={(e) => update('pitch', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Angles are in radians. <strong className="text-gray-400">Yaw</strong>: 0 = forward, ≈1.57 = right, ≈3.14 = back, ≈−1.57 = left. <strong className="text-gray-400">Pitch</strong>: 0 = level, 1.57 = straight up, −1.57 = straight down. Tip: drag the preview to the spot you want, then use the &ldquo;Place hotspot here&rdquo; button instead of entering numbers manually.
          </p>

          {error && (
            <p role="alert" className="text-xs text-red-400">{error}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 px-5 py-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-4 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg text-sm transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-11 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-semibold rounded-lg transition"
          >
            {initial ? 'Save hotspot' : 'Add hotspot'}
          </button>
        </div>
      </form>
    </div>
  );
}
