'use client';

// components/academy/tour-editor/SceneLinkFormModal.tsx
// Create-or-edit modal for a single scene link (floor-arrow that moves the
// learner from one scene to another). Target scene is picked from a
// dropdown of all other scenes in the tour.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { EditorScene, EditorSceneLink } from './TourEditor';

interface SceneLinkFormModalProps {
  initial: EditorSceneLink | null;
  /** Pre-fill yaw/pitch when creating a new link (from the preview's "Place scene link here" button). */
  initialPosition?: { yaw: number; pitch: number };
  currentSceneSlug: string;
  allScenes: EditorScene[];
  onSave: (link: EditorSceneLink) => void;
  onCancel: () => void;
}

const PITCH_MIN = -Math.PI / 2;
const PITCH_MAX = Math.PI / 2;
const YAW_MIN = -Math.PI * 2;
const YAW_MAX = Math.PI * 2;

export default function SceneLinkFormModal({
  initial,
  initialPosition,
  currentSceneSlug,
  allScenes,
  onSave,
  onCancel,
}: SceneLinkFormModalProps) {
  const [state, setState] = useState<EditorSceneLink>(() => {
    if (initial) return initial;
    return {
      local_id: crypto.randomUUID(),
      to_scene_slug: '',
      yaw: initialPosition?.yaw ?? 0,
      // Default pitch is slightly downward so links sit as floor arrows,
      // but if the user picked a position via the preview, honor that.
      pitch: initialPosition?.pitch ?? -0.5,
      label: null,
    };
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const availableTargets = allScenes.filter((s) => s.slug !== currentSceneSlug);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.to_scene_slug) {
      setError('Pick a target scene.');
      return;
    }
    onSave({
      ...state,
      label: state.label?.trim() || null,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scene-link-modal-title"
      // Dock to the right on desktop so the preview stays visible. Bottom
      // sheet on mobile.
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
          <h2 id="scene-link-modal-title" className="text-base font-semibold text-white">
            {initial ? 'Edit scene link' : 'Add scene link'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 min-w-11 -m-2 flex items-center justify-center text-gray-400 hover:text-white"
            aria-label="Close scene link form"
            title="Close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="link-target" className="block text-xs text-gray-400 mb-1">Target scene *</label>
            <select
              id="link-target"
              value={state.to_scene_slug}
              onChange={(e) => {
                setState((prev) => ({ ...prev, to_scene_slug: e.target.value }));
                setError(null);
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
            >
              <option value="">— Select a scene —</option>
              {availableTargets.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="link-label" className="block text-xs text-gray-400 mb-1">Label (optional)</label>
            <input
              id="link-label"
              type="text"
              value={state.label ?? ''}
              onChange={(e) => setState((prev) => ({ ...prev, label: e.target.value || null }))}
              placeholder="Shown as a tooltip over the link arrow"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 min-h-11"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="link-yaw" className="block text-xs text-gray-400 mb-1">
                Yaw <span className="text-gray-500">(−6.28 to 6.28)</span>
              </label>
              <input
                id="link-yaw"
                type="number"
                step="0.01"
                min={YAW_MIN}
                max={YAW_MAX}
                value={state.yaw}
                onChange={(e) => setState((prev) => ({ ...prev, yaw: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
              />
            </div>
            <div>
              <label htmlFor="link-pitch" className="block text-xs text-gray-400 mb-1">
                Pitch <span className="text-gray-500">(−1.57 to 1.57)</span>
              </label>
              <input
                id="link-pitch"
                type="number"
                step="0.01"
                min={PITCH_MIN}
                max={PITCH_MAX}
                value={state.pitch}
                onChange={(e) => setState((prev) => ({ ...prev, pitch: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Angles are in radians. <strong className="text-gray-400">Yaw</strong>: 0 = forward, ±1.57 = right/left, ±3.14 = back. <strong className="text-gray-400">Pitch</strong>: 0 = level, negative = down (default −0.5 for floor arrows), positive = up. Tip: drag the preview to aim, then click &ldquo;Place scene link here&rdquo;.
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
            {initial ? 'Save link' : 'Add link'}
          </button>
        </div>
      </form>
    </div>
  );
}
