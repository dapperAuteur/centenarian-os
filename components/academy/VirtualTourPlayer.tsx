'use client';

// components/academy/VirtualTourPlayer.tsx
// Multi-scene immersive tour player for the `virtual_tour` lesson type.
// Wraps Photo Sphere Viewer with VirtualTourPlugin (scene navigation) and
// MarkersPlugin (hotspots). Takes an AssembledTour from the API and builds
// the PSV node graph via lib/academy/assembleTour's output shape.
//
// PSV modules are dynamic-imported inside useEffect so the chunk only loads
// when a learner actually opens a virtual tour lesson.
//
// Plan 23b will add completion tracking (count opened hotspots) and wire
// the onHotspotOpen callback to lesson_progress.

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { AssembledTour, TourHotspot } from '@/lib/academy/tour-types';

interface VirtualTourPlayerProps {
  tour: AssembledTour;
  /** Fires when a hotspot is opened for the first time. Plan 23b wires this to completion tracking. */
  onHotspotOpen?: (hotspotId: string) => void;
  /** Fires the first time the entry scene finishes loading. Used as a "started tour" signal. */
  onReady?: () => void;
}

function VirtualTourPlayerInner({ tour, onHotspotOpen, onReady }: VirtualTourPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeHotspot, setActiveHotspot] = useState<TourHotspot | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!tour.entry_scene_id || tour.scenes.length === 0) {
      setError('This tour has no scenes yet. The teacher is still building it.');
      setLoading(false);
      return;
    }

    let viewer: import('@photo-sphere-viewer/core').Viewer | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Viewer } = await import('@photo-sphere-viewer/core');
        const { VirtualTourPlugin } = await import('@photo-sphere-viewer/virtual-tour-plugin');
        const { MarkersPlugin } = await import('@photo-sphere-viewer/markers-plugin');
        const { GyroscopePlugin } = await import('@photo-sphere-viewer/gyroscope-plugin');
        await import('@photo-sphere-viewer/core/index.css');
        await import('@photo-sphere-viewer/virtual-tour-plugin/index.css');
        await import('@photo-sphere-viewer/markers-plugin/index.css');

        if (cancelled || !containerRef.current) return;

        // Build the node graph: one PSV node per scene, each with its
        // hotspots rendered as MarkersPlugin markers and its outgoing
        // scene links expressed as VirtualTourPlugin links.
        const nodes = tour.scenes.map((scene) => ({
          id: scene.id,
          panorama: scene.panorama_url,
          thumbnail: scene.poster_url ?? undefined,
          name: scene.name,
          caption: scene.caption ?? undefined,
          sphereCorrection: { pan: 0, tilt: 0, roll: 0 },
          // Outgoing scene links become PSV virtual-tour links
          links: scene.outgoing_links.map((link) => ({
            nodeId: link.to_scene_id,
            position: { yaw: link.yaw, pitch: link.pitch },
            name: link.label ?? undefined,
          })),
          // Hotspots become PSV markers
          markers: scene.hotspots.map((hotspot) => ({
            id: hotspot.id,
            position: { yaw: hotspot.yaw, pitch: hotspot.pitch },
            html: `<div class="tour-hotspot-dot" aria-label="${hotspot.title.replace(/"/g, '&quot;')}"></div>`,
            anchor: 'center center' as const,
            tooltip: hotspot.title,
            data: { hotspot },
          })),
        }));

        viewer = new Viewer({
          container: containerRef.current,
          keyboard: 'always',
          navbar: ['zoom', 'move', 'caption', 'gyroscope', 'fullscreen'],
          plugins: [
            [MarkersPlugin, {}],
            GyroscopePlugin,
            [
              VirtualTourPlugin,
              {
                positionMode: 'manual',
                renderMode: '3d',
                nodes,
                startNodeId: tour.entry_scene_id ?? undefined,
              },
            ],
          ],
        });

        viewer.addEventListener('ready', () => {
          if (!cancelled) {
            setLoading(false);
            onReady?.();
          }
        });

        // MarkersPlugin types come from a local shim while the real package
        // can't be installed (see types/photo-sphere-viewer-plugins.d.ts).
        // Type the event handler parameter explicitly to satisfy strict TS.
        const markersPlugin = viewer.getPlugin(MarkersPlugin) as {
          addEventListener: (
            event: 'select-marker',
            handler: (e: { marker: { data?: { hotspot?: TourHotspot } } }) => void,
          ) => void;
        } | null;
        markersPlugin?.addEventListener('select-marker', (e) => {
          if (cancelled) return;
          const hotspot = e.marker.data?.hotspot;
          if (!hotspot) return;
          setActiveHotspot(hotspot);
          onHotspotOpen?.(hotspot.id);

          if (hotspot.hotspot_type === 'link' && hotspot.external_url) {
            window.open(hotspot.external_url, '_blank', 'noopener,noreferrer');
          }
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load virtual tour player', err);
        setError('Could not load the virtual tour player. Try refreshing the page.');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [tour, onHotspotOpen, onReady]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl overflow-hidden mb-6">
      <div className="relative">
        <div
          ref={containerRef}
          role="application"
          aria-label="Virtual tour. Drag to look around. Click the floor arrows to move between scenes. Click highlighted points to open information."
          className="w-full bg-black"
          style={{ height: 'min(70vh, 600px)' }}
        />
        {loading && !error && (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center bg-black/80 text-white"
          >
            <span className="text-sm">Loading virtual tour…</span>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="absolute inset-0 flex items-center justify-center bg-black/90 text-red-300 px-4 text-center text-sm"
          >
            {error}
          </div>
        )}

        {/* Hotspot info panel — shown when a learner clicks a hotspot marker */}
        {activeHotspot && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hotspot-title"
            className="absolute right-3 bottom-16 sm:right-6 sm:bottom-20 w-[min(22rem,calc(100%-1.5rem))] bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl p-4 backdrop-blur-sm"
          >
            <div className="flex items-start gap-2 mb-2">
              <h3 id="hotspot-title" className="flex-1 text-sm font-semibold text-white">{activeHotspot.title}</h3>
              <button
                type="button"
                onClick={() => setActiveHotspot(null)}
                className="min-h-11 min-w-11 -m-2 flex items-center justify-center text-gray-400 hover:text-white transition"
                aria-label="Close hotspot panel"
                title="Close"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            {activeHotspot.body && (
              <p className="text-sm text-gray-300 whitespace-pre-wrap mb-3">{activeHotspot.body}</p>
            )}
            {activeHotspot.hotspot_type === 'audio' && activeHotspot.audio_url && (
              <audio controls src={activeHotspot.audio_url} className="w-full">
                Your browser does not support the audio element.
              </audio>
            )}
            {activeHotspot.hotspot_type === 'link' && activeHotspot.external_url && (
              <a
                href={activeHotspot.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-fuchsia-400 hover:text-fuchsia-300 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                Open link
              </a>
            )}
          </div>
        )}
      </div>
      <p className="px-4 sm:px-6 py-3 text-xs text-gray-400 border-t border-gray-800">
        Drag to look around. Click floor arrows to walk between scenes. Click highlighted points to open information, audio, or links.
      </p>
    </div>
  );
}

const VirtualTourPlayer = dynamic(() => Promise.resolve(VirtualTourPlayerInner), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl mb-6 flex items-center justify-center text-white text-sm"
      style={{ height: 'min(70vh, 600px)' }}
    >
      Loading virtual tour…
    </div>
  ),
});

export default VirtualTourPlayer;
