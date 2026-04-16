'use client';

// components/academy/tour-editor/ScenePreviewPanel.tsx
// Interactive PSV preview of a single scene inside the tour editor. Shows the
// teacher what the scene looks like at the current start orientation AND
// exposes the live camera yaw/pitch as the teacher drags around, so they
// can pick a position for a hotspot or scene link and copy it into the
// respective form without guessing numbers.
//
// Exposes two callbacks to the parent:
//   - onPositionChange(yaw, pitch): fires ~4x/sec while the user drags
//   - onUsePositionForHotspot / onUsePositionForSceneLink: the two big
//     "Use this position" buttons underneath the preview

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';

interface ScenePreviewPanelProps {
  panoramaUrl: string;
  startYaw: number;
  startPitch: number;
  onUsePositionForHotspot?: (yaw: number, pitch: number) => void;
  onUsePositionForSceneLink?: (yaw: number, pitch: number) => void;
}

function ScenePreviewPanelInner({
  panoramaUrl,
  startYaw,
  startPitch,
  onUsePositionForHotspot,
  onUsePositionForSceneLink,
}: ScenePreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentYaw, setCurrentYaw] = useState(startYaw);
  const [currentPitch, setCurrentPitch] = useState(startPitch);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: import('@photo-sphere-viewer/core').Viewer | null = null;
    let cancelled = false;
    let lastSamples: { yaw: number; pitch: number } = { yaw: startYaw, pitch: startPitch };
    let intervalId: ReturnType<typeof setInterval> | null = null;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { Viewer } = await import('@photo-sphere-viewer/core');
        await import('@photo-sphere-viewer/core/index.css');

        if (cancelled || !containerRef.current) return;

        viewer = new Viewer({
          container: containerRef.current,
          panorama: panoramaUrl,
          defaultYaw: startYaw,
          defaultPitch: startPitch,
          navbar: ['zoom', 'move', 'fullscreen'],
        });
        viewer.addEventListener('ready', () => {
          if (!cancelled) setLoading(false);
        });

        // Poll the camera position at ~4Hz. Cheaper than 'position-updated'
        // events which fire 60Hz and cause re-render churn.
        intervalId = setInterval(() => {
          if (cancelled || !viewer) return;
          const pos = viewer.getPosition();
          if (pos.yaw !== lastSamples.yaw || pos.pitch !== lastSamples.pitch) {
            lastSamples = { yaw: pos.yaw, pitch: pos.pitch };
            setCurrentYaw(pos.yaw);
            setCurrentPitch(pos.pitch);
          }
        }, 250);
      } catch (err) {
        if (cancelled) return;
        console.error('[ScenePreview] load error', err);
        setError('Could not load preview. Check the panorama URL.');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      viewer?.destroy();
    };
  }, [panoramaUrl, startYaw, startPitch]);

  const formatted = (n: number) => n.toFixed(2);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="relative">
        <div
          ref={containerRef}
          role="application"
          aria-label="Scene preview. Drag to look around."
          className="w-full bg-black"
          style={{ height: 'min(55vh, 500px)' }}
        />
        {loading && !error && (
          <div role="status" className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
            <span className="text-sm">Loading preview…</span>
          </div>
        )}
        {error && (
          <div role="alert" className="absolute inset-0 flex items-center justify-center bg-black/90 text-red-300 px-4 text-center text-sm">
            {error}
          </div>
        )}
        {/* Live yaw/pitch readout */}
        {!loading && !error && (
          <div
            className="absolute top-3 left-3 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 backdrop-blur-sm pointer-events-none"
            aria-live="polite"
            aria-label={`Current view: yaw ${formatted(currentYaw)}, pitch ${formatted(currentPitch)}`}
          >
            <span className="text-gray-500">yaw</span>{' '}
            <span className="tabular-nums text-fuchsia-300">{formatted(currentYaw)}</span>
            <span className="text-gray-600 mx-1.5">·</span>
            <span className="text-gray-500">pitch</span>{' '}
            <span className="tabular-nums text-fuchsia-300">{formatted(currentPitch)}</span>
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-gray-800 flex flex-col sm:flex-row gap-2">
        <p className="text-xs text-gray-500 flex-1 min-w-0">
          Drag to aim at where you want a hotspot or scene link. Then click one of the buttons to start placing it.
        </p>
        {onUsePositionForHotspot && (
          <button
            type="button"
            disabled={loading || !!error}
            onClick={() => onUsePositionForHotspot(currentYaw, currentPitch)}
            className="min-h-11 flex items-center justify-center gap-1.5 px-3 py-2 bg-fuchsia-900/40 hover:bg-fuchsia-900/60 border border-fuchsia-700 rounded-lg text-xs font-medium text-fuchsia-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Use the current view position for a new hotspot"
          >
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            Place hotspot here
          </button>
        )}
        {onUsePositionForSceneLink && (
          <button
            type="button"
            disabled={loading || !!error}
            onClick={() => onUsePositionForSceneLink(currentYaw, currentPitch)}
            className="min-h-11 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-medium text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Use the current view position for a new scene link"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Place scene link here
          </button>
        )}
      </div>
    </div>
  );
}

const ScenePreviewPanel = dynamic(() => Promise.resolve(ScenePreviewPanelInner), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center text-white text-sm"
      style={{ height: 'min(55vh, 500px)' }}
    >
      Loading preview…
    </div>
  ),
});

export default ScenePreviewPanel;
