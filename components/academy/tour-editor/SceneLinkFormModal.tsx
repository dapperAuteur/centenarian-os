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
  currentSceneSlug: string;
  allScenes: EditorScene[];
  onSave: (link: EditorSceneLink) => void;
  onCancel: () => void;
}

export default function SceneLinkFormModal({
  initial,
  currentSceneSlug,
  allScenes,
  onSave,
  onCancel,
}: SceneLinkFormModalProps) {
  const [state, setState] = useState<EditorSceneLink>(() =>
    initial ?? {
      local_id: crypto.randomUUID(),
      to_scene_slug: '',
      yaw: 0,
      pitch: -0.5, // slight downward — floor arrows sit below eye level
      label: null,
    },
  );
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 dark-input"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
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
              <label htmlFor="link-yaw" className="block text-xs text-gray-400 mb-1">Yaw (radians)</label>
              <input
                id="link-yaw"
                type="number"
                step="0.01"
                value={state.yaw}
                onChange={(e) => setState((prev) => ({ ...prev, yaw: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
              />
            </div>
            <div>
              <label htmlFor="link-pitch" className="block text-xs text-gray-400 mb-1">Pitch (radians)</label>
              <input
                id="link-pitch"
                type="number"
                step="0.01"
                value={state.pitch}
                onChange={(e) => setState((prev) => ({ ...prev, pitch: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Links default to slightly downward so they appear as floor arrows. Yaw 0 points forward from the scene&apos;s start orientation.
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
