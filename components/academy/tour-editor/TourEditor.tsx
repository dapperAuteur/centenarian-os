'use client';

// components/academy/tour-editor/TourEditor.tsx
// Main layout for the virtual tour scene editor. Holds the entire editor
// state in one place (scenes, hotspots, scene links, entry scene). All
// mutations are local until the teacher clicks "Save tour", at which
// point the full state is PUT to the tour API as a single payload.
//
// For v1, hotspot and scene-link placement is number-based (teachers enter
// yaw/pitch as decimals). A later branch can add click-to-place inside the
// PSV canvas. The PSV preview here is read-only — it shows what the tour
// looks like to a learner so teachers can sanity-check their work.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, Save, Plus, Trash2, Star, AlertCircle, CheckCircle2 } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import Cloudinary360Uploader from '@/components/academy/Cloudinary360Uploader';
import type { AssembledTour, HotspotType } from '@/lib/academy/tour-types';
import HotspotFormModal from './HotspotFormModal';
import SceneLinkFormModal from './SceneLinkFormModal';
import ScenePreviewPanel from './ScenePreviewPanel';

export interface EditorHotspot {
  local_id: string;
  hotspot_type: HotspotType;
  yaw: number;
  pitch: number;
  title: string;
  body: string | null;
  audio_url: string | null;
  external_url: string | null;
  target_scene_slug: string | null;
  icon: string;
}

export interface EditorSceneLink {
  local_id: string;
  to_scene_slug: string;
  yaw: number;
  pitch: number;
  label: string | null;
}

export interface EditorScene {
  slug: string;
  name: string;
  caption: string | null;
  panorama_url: string;
  panorama_type: 'photo' | 'video';
  poster_url: string | null;
  start_yaw: number;
  start_pitch: number;
  is_entry_scene: boolean;
  order_index: number;
  hotspots: EditorHotspot[];
  outgoing_links: EditorSceneLink[];
}

interface TourEditorProps {
  courseId: string;
  lessonId: string;
}

function slugify(input: string, existingSlugs: Set<string>): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `scene-${Date.now().toString(36)}`;
  if (!existingSlugs.has(base)) return base;
  let i = 2;
  while (existingSlugs.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export default function TourEditor({ courseId, lessonId }: TourEditorProps) {
  const [scenes, setScenes] = useState<EditorScene[]>([]);
  const [selectedSceneSlug, setSelectedSceneSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [hotspotModalState, setHotspotModalState] = useState<{ sceneSlug: string; hotspot: EditorHotspot | null } | null>(null);
  const [linkModalState, setLinkModalState] = useState<{ sceneSlug: string; link: EditorSceneLink | null } | null>(null);

  // Load the existing tour on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await offlineFetch(`/api/academy/courses/${courseId}/lessons/${lessonId}/tour`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as AssembledTour;
        if (cancelled) return;

        // Build a slug → slug index so hotspot.target_scene_id and
        // scene_link.to_scene_id can be remapped to slugs (the editor
        // thinks in slugs so that newly-added scenes without server ids
        // can still be referenced).
        const idToSlug = new Map<string, string>();
        for (const s of data.scenes) idToSlug.set(s.id, s.slug);

        const editorScenes: EditorScene[] = data.scenes.map((s) => ({
          slug: s.slug,
          name: s.name,
          caption: s.caption,
          panorama_url: s.panorama_url,
          panorama_type: s.panorama_type,
          poster_url: s.poster_url,
          start_yaw: s.start_yaw,
          start_pitch: s.start_pitch,
          is_entry_scene: s.is_entry_scene,
          order_index: s.order_index,
          hotspots: s.hotspots.map((h) => ({
            local_id: crypto.randomUUID(),
            hotspot_type: h.hotspot_type,
            yaw: h.yaw,
            pitch: h.pitch,
            title: h.title,
            body: h.body,
            audio_url: h.audio_url,
            external_url: h.external_url,
            target_scene_slug: h.target_scene_id ? idToSlug.get(h.target_scene_id) ?? null : null,
            icon: h.icon,
          })),
          outgoing_links: s.outgoing_links.map((l) => ({
            local_id: crypto.randomUUID(),
            to_scene_slug: idToSlug.get(l.to_scene_id) ?? '',
            yaw: l.yaw,
            pitch: l.pitch,
            label: l.label,
          })),
        }));

        setScenes(editorScenes);
        setSelectedSceneSlug(editorScenes[0]?.slug ?? null);
      } catch (err) {
        if (!cancelled) {
          console.error('[TourEditor] load error', err);
          setLoadError('Could not load the tour. Check your connection and try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId, lessonId]);

  const existingSlugs = useMemo(() => new Set(scenes.map((s) => s.slug)), [scenes]);
  const selectedScene = scenes.find((s) => s.slug === selectedSceneSlug) ?? null;

  const markDirty = useCallback(() => setDirty(true), []);

  // ── Scene CRUD ────────────────────────────────────────────────────────

  function addScene(name: string, panoramaUrl: string, panoramaType: 'photo' | 'video', posterUrl: string | null) {
    const slug = slugify(name || 'scene', existingSlugs);
    const newScene: EditorScene = {
      slug,
      name: name || 'Untitled scene',
      caption: null,
      panorama_url: panoramaUrl,
      panorama_type: panoramaType,
      poster_url: posterUrl,
      start_yaw: 0,
      start_pitch: 0,
      is_entry_scene: scenes.length === 0, // first scene auto-entry
      order_index: scenes.length,
      hotspots: [],
      outgoing_links: [],
    };
    setScenes((prev) => [...prev, newScene]);
    setSelectedSceneSlug(slug);
    markDirty();
  }

  function updateScene(slug: string, updates: Partial<EditorScene>) {
    setScenes((prev) => prev.map((s) => (s.slug === slug ? { ...s, ...updates } : s)));
    markDirty();
  }

  function deleteScene(slug: string) {
    setScenes((prev) => {
      const next = prev
        .filter((s) => s.slug !== slug)
        .map((s, i) => ({
          ...s,
          order_index: i,
          // Strip any hotspot / link references to the deleted scene
          hotspots: s.hotspots.map((h) =>
            h.target_scene_slug === slug ? { ...h, target_scene_slug: null } : h,
          ),
          outgoing_links: s.outgoing_links.filter((l) => l.to_scene_slug !== slug),
        }));
      // If we deleted the entry scene, promote the first remaining scene
      if (!next.some((s) => s.is_entry_scene) && next[0]) {
        next[0] = { ...next[0], is_entry_scene: true };
      }
      return next;
    });
    if (selectedSceneSlug === slug) {
      setSelectedSceneSlug(scenes.find((s) => s.slug !== slug)?.slug ?? null);
    }
    markDirty();
  }

  function setEntryScene(slug: string) {
    setScenes((prev) => prev.map((s) => ({ ...s, is_entry_scene: s.slug === slug })));
    markDirty();
  }

  function moveScene(slug: string, direction: 'up' | 'down') {
    setScenes((prev) => {
      const idx = prev.findIndex((s) => s.slug === slug);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, order_index: i }));
    });
    markDirty();
  }

  // ── Hotspot CRUD ──────────────────────────────────────────────────────

  function saveHotspot(sceneSlug: string, hotspot: EditorHotspot) {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.slug !== sceneSlug) return s;
        const existing = s.hotspots.findIndex((h) => h.local_id === hotspot.local_id);
        const nextHotspots = existing >= 0
          ? s.hotspots.map((h) => (h.local_id === hotspot.local_id ? hotspot : h))
          : [...s.hotspots, hotspot];
        return { ...s, hotspots: nextHotspots };
      }),
    );
    markDirty();
    setHotspotModalState(null);
  }

  function deleteHotspot(sceneSlug: string, hotspotLocalId: string) {
    setScenes((prev) =>
      prev.map((s) =>
        s.slug === sceneSlug
          ? { ...s, hotspots: s.hotspots.filter((h) => h.local_id !== hotspotLocalId) }
          : s,
      ),
    );
    markDirty();
  }

  // ── Scene link CRUD ───────────────────────────────────────────────────

  function saveSceneLink(sceneSlug: string, link: EditorSceneLink) {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.slug !== sceneSlug) return s;
        const existing = s.outgoing_links.findIndex((l) => l.local_id === link.local_id);
        const nextLinks = existing >= 0
          ? s.outgoing_links.map((l) => (l.local_id === link.local_id ? link : l))
          : [...s.outgoing_links, link];
        return { ...s, outgoing_links: nextLinks };
      }),
    );
    markDirty();
    setLinkModalState(null);
  }

  function deleteSceneLink(sceneSlug: string, linkLocalId: string) {
    setScenes((prev) =>
      prev.map((s) =>
        s.slug === sceneSlug
          ? { ...s, outgoing_links: s.outgoing_links.filter((l) => l.local_id !== linkLocalId) }
          : s,
      ),
    );
    markDirty();
  }

  // ── Save ──────────────────────────────────────────────────────────────

  async function saveTour() {
    // Publishing guard: must have at least one scene and exactly one entry scene.
    if (scenes.length === 0) {
      setSaveMessage({ kind: 'error', text: 'Add at least one scene before saving.' });
      return;
    }
    const entryCount = scenes.filter((s) => s.is_entry_scene).length;
    if (entryCount === 0) {
      setSaveMessage({ kind: 'error', text: 'Mark one scene as the entry scene before saving.' });
      return;
    }
    if (entryCount > 1) {
      setSaveMessage({ kind: 'error', text: 'Only one scene can be the entry scene.' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    // Shape the payload to match the PUT endpoint's expected structure
    const payload = {
      scenes: scenes.map((s, i) => ({
        slug: s.slug,
        name: s.name,
        caption: s.caption,
        panorama_url: s.panorama_url,
        panorama_type: s.panorama_type,
        poster_url: s.poster_url,
        start_yaw: s.start_yaw,
        start_pitch: s.start_pitch,
        is_entry_scene: s.is_entry_scene,
        order_index: s.order_index ?? i,
      })),
      hotspots: scenes.flatMap((s) =>
        s.hotspots.map((h) => ({
          scene_slug: s.slug,
          hotspot_type: h.hotspot_type,
          yaw: h.yaw,
          pitch: h.pitch,
          title: h.title,
          body: h.body,
          audio_url: h.audio_url,
          external_url: h.external_url,
          target_scene_slug: h.target_scene_slug,
          icon: h.icon,
        })),
      ),
      scene_links: scenes.flatMap((s) =>
        s.outgoing_links.map((l) => ({
          from_scene_slug: s.slug,
          to_scene_slug: l.to_scene_slug,
          yaw: l.yaw,
          pitch: l.pitch,
          label: l.label,
        })),
      ),
    };

    try {
      const r = await offlineFetch(`/api/academy/courses/${courseId}/lessons/${lessonId}/tour`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDirty(false);
      setSaveMessage({ kind: 'success', text: 'Tour saved.' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('[TourEditor] save error', err);
      setSaveMessage({ kind: 'error', text: 'Save failed. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />
        Loading tour…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-red-300 px-4 text-center">
        <AlertCircle className="w-5 h-5 mr-2 shrink-0" aria-hidden="true" />
        {loadError}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link
          href={`/dashboard/teaching/courses/${courseId}`}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition min-h-11"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back to course
        </Link>
        <span className="text-gray-700 hidden sm:inline">|</span>
        <h1 className="text-sm sm:text-base font-semibold flex-1 min-w-0 truncate">Virtual tour editor</h1>
        {saveMessage && (
          <span
            role={saveMessage.kind === 'error' ? 'alert' : 'status'}
            className={`text-xs hidden sm:flex items-center gap-1 ${
              saveMessage.kind === 'success' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {saveMessage.kind === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {saveMessage.text}
          </span>
        )}
        <button
          type="button"
          onClick={saveTour}
          disabled={saving || !dirty}
          className="min-h-11 flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
          title={dirty ? 'Save tour' : 'No unsaved changes'}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Save tour'}
        </button>
      </header>

      {saveMessage && (
        <div
          role={saveMessage.kind === 'error' ? 'alert' : 'status'}
          className={`sm:hidden border-b border-gray-800 px-4 py-2 text-xs flex items-center gap-1 ${
            saveMessage.kind === 'success' ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {saveMessage.kind === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {saveMessage.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar: scenes list */}
        <aside className="lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-800 p-4 space-y-3 dark-input">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Scenes</h2>
            <span className="text-xs text-gray-500">{scenes.length}</span>
          </div>

          {scenes.length === 0 && (
            <p className="text-xs text-gray-500">No scenes yet. Upload a 360° panorama to get started.</p>
          )}

          <ul className="space-y-1.5" role="list">
            {scenes.map((scene, i) => {
              const isSelected = scene.slug === selectedSceneSlug;
              return (
                <li key={scene.slug}>
                  <button
                    type="button"
                    onClick={() => setSelectedSceneSlug(scene.slug)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg transition min-h-11 ${
                      isSelected
                        ? 'bg-fuchsia-900/40 text-white border border-fuchsia-700'
                        : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-xs text-gray-500 tabular-nums w-5 shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm truncate">{scene.name}</span>
                    {scene.is_entry_scene && (
                      <Star className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" aria-label="Entry scene" />
                    )}
                  </button>
                  {isSelected && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5 ml-7">
                      <button
                        type="button"
                        onClick={() => moveScene(scene.slug, 'up')}
                        disabled={i === 0}
                        className="min-h-11 px-2 py-1 text-xs text-gray-400 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        ↑ Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveScene(scene.slug, 'down')}
                        disabled={i === scenes.length - 1}
                        className="min-h-11 px-2 py-1 text-xs text-gray-400 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        ↓ Down
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntryScene(scene.slug)}
                        disabled={scene.is_entry_scene}
                        className="min-h-11 px-2 py-1 text-xs text-gray-400 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        title="Mark as the first scene a learner sees"
                      >
                        ★ Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete scene "${scene.name}"? This cannot be undone until you save the tour.`)) {
                            deleteScene(scene.slug);
                          }
                        }}
                        className="min-h-11 px-2 py-1 text-xs text-red-400 bg-gray-800 rounded hover:bg-red-900/40 transition"
                      >
                        <Trash2 className="w-3 h-3 inline" aria-hidden="true" /> Delete
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="pt-3 border-t border-gray-800 space-y-2">
            <p className="text-xs text-gray-500">Add scene — upload a 360° panorama (JPG, PNG) or video (MP4, WebM).</p>
            <Cloudinary360Uploader
              resourceType="image"
              onUploadSuccess={(url, posterUrl) => {
                const name = `Scene ${scenes.length + 1}`;
                addScene(name, url, 'photo', posterUrl);
              }}
            />
          </div>
        </aside>

        {/* Main: active scene preview + hotspot/link lists */}
        <main className="flex-1 p-4 sm:p-6 space-y-6">
          {!selectedScene && scenes.length > 0 && (
            <p className="text-sm text-gray-500">Select a scene on the left to edit it.</p>
          )}
          {selectedScene && (
            <>
              {/* Scene metadata */}
              <div className="space-y-3 dark-input">
                <div>
                  <label htmlFor={`scene-name-${selectedScene.slug}`} className="block text-xs text-gray-400 mb-1">Scene name</label>
                  <input
                    id={`scene-name-${selectedScene.slug}`}
                    type="text"
                    value={selectedScene.name}
                    onChange={(e) => updateScene(selectedScene.slug, { name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
                  />
                </div>
                <div>
                  <label htmlFor={`scene-caption-${selectedScene.slug}`} className="block text-xs text-gray-400 mb-1">Caption (optional)</label>
                  <input
                    id={`scene-caption-${selectedScene.slug}`}
                    type="text"
                    value={selectedScene.caption ?? ''}
                    onChange={(e) => updateScene(selectedScene.slug, { caption: e.target.value || null })}
                    placeholder="Shown in the top-left of the player"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 min-h-11"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`scene-yaw-${selectedScene.slug}`} className="block text-xs text-gray-400 mb-1">Start yaw (radians)</label>
                    <input
                      id={`scene-yaw-${selectedScene.slug}`}
                      type="number"
                      step="0.01"
                      value={selectedScene.start_yaw}
                      onChange={(e) => updateScene(selectedScene.slug, { start_yaw: Number(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
                    />
                  </div>
                  <div>
                    <label htmlFor={`scene-pitch-${selectedScene.slug}`} className="block text-xs text-gray-400 mb-1">Start pitch (radians)</label>
                    <input
                      id={`scene-pitch-${selectedScene.slug}`}
                      type="number"
                      step="0.01"
                      value={selectedScene.start_pitch}
                      onChange={(e) => updateScene(selectedScene.slug, { start_pitch: Number(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
                    />
                  </div>
                </div>
              </div>

              {/* PSV preview — read-only, shows the scene as a learner sees it */}
              <ScenePreviewPanel
                key={selectedScene.slug}
                panoramaUrl={selectedScene.panorama_url}
                startYaw={selectedScene.start_yaw}
                startPitch={selectedScene.start_pitch}
              />

              {/* Hotspots */}
              <section className="space-y-2 dark-input">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-200">Hotspots ({selectedScene.hotspots.length})</h3>
                  <button
                    type="button"
                    onClick={() => setHotspotModalState({ sceneSlug: selectedScene.slug, hotspot: null })}
                    className="min-h-11 flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add hotspot
                  </button>
                </div>
                {selectedScene.hotspots.length === 0 ? (
                  <p className="text-xs text-gray-500">No hotspots yet. Add one to give learners something to click.</p>
                ) : (
                  <ul className="space-y-1.5" role="list">
                    {selectedScene.hotspots.map((h) => (
                      <li
                        key={h.local_id}
                        className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                      >
                        <span className="text-xs text-gray-500 uppercase tracking-wide shrink-0 w-16">{h.hotspot_type}</span>
                        <span className="flex-1 truncate text-gray-200">{h.title}</span>
                        <span className="text-xs text-gray-500 tabular-nums shrink-0 hidden sm:inline">
                          yaw {h.yaw.toFixed(2)} · pitch {h.pitch.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setHotspotModalState({ sceneSlug: selectedScene.slug, hotspot: h })}
                          className="min-h-11 px-2 text-xs text-fuchsia-400 hover:text-fuchsia-300"
                          title="Edit hotspot"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHotspot(selectedScene.slug, h.local_id)}
                          className="min-h-11 px-2 text-xs text-red-400 hover:text-red-300"
                          title="Delete hotspot"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Scene links */}
              <section className="space-y-2 dark-input">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-200">Outgoing scene links ({selectedScene.outgoing_links.length})</h3>
                  <button
                    type="button"
                    onClick={() => setLinkModalState({ sceneSlug: selectedScene.slug, link: null })}
                    disabled={scenes.length < 2}
                    className="min-h-11 flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title={scenes.length < 2 ? 'Need at least 2 scenes to create a link' : 'Add a link from this scene to another'}
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add scene link
                  </button>
                </div>
                {selectedScene.outgoing_links.length === 0 ? (
                  <p className="text-xs text-gray-500">No outgoing links. Add one to let learners walk to another scene.</p>
                ) : (
                  <ul className="space-y-1.5" role="list">
                    {selectedScene.outgoing_links.map((l) => {
                      const target = scenes.find((s) => s.slug === l.to_scene_slug);
                      return (
                        <li
                          key={l.local_id}
                          className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                        >
                          <span className="text-xs text-gray-500 uppercase tracking-wide shrink-0 w-12">link</span>
                          <span className="flex-1 truncate text-gray-200">
                            → {target?.name ?? <span className="text-red-400">(missing)</span>}
                            {l.label && <span className="text-gray-500 ml-2">&ldquo;{l.label}&rdquo;</span>}
                          </span>
                          <span className="text-xs text-gray-500 tabular-nums shrink-0 hidden sm:inline">
                            yaw {l.yaw.toFixed(2)} · pitch {l.pitch.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setLinkModalState({ sceneSlug: selectedScene.slug, link: l })}
                            className="min-h-11 px-2 text-xs text-fuchsia-400 hover:text-fuchsia-300"
                            title="Edit link"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSceneLink(selectedScene.slug, l.local_id)}
                            className="min-h-11 px-2 text-xs text-red-400 hover:text-red-300"
                            title="Delete link"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      {hotspotModalState && (
        <HotspotFormModal
          initial={hotspotModalState.hotspot}
          allScenes={scenes}
          onSave={(h) => saveHotspot(hotspotModalState.sceneSlug, h)}
          onCancel={() => setHotspotModalState(null)}
        />
      )}
      {linkModalState && (
        <SceneLinkFormModal
          initial={linkModalState.link}
          currentSceneSlug={linkModalState.sceneSlug}
          allScenes={scenes}
          onSave={(l) => saveSceneLink(linkModalState.sceneSlug, l)}
          onCancel={() => setLinkModalState(null)}
        />
      )}
    </div>
  );
}
