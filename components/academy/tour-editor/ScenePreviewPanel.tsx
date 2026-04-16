'use client';

// components/academy/tour-editor/ScenePreviewPanel.tsx
// Read-only PSV preview of a single scene inside the tour editor. Shows the
// teacher what the scene looks like with the chosen start orientation but
// deliberately has no hotspots or scene-link arrows — those are managed via
// the sidebar lists. The preview reinitializes whenever the panorama URL or
// start orientation changes.

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

interface ScenePreviewPanelProps {
  panoramaUrl: string;
  startYaw: number;
  startPitch: number;
}

function ScenePreviewPanelInner({ panoramaUrl, startYaw, startPitch }: ScenePreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: import('@photo-sphere-viewer/core').Viewer | null = null;
    let cancelled = false;
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
      } catch (err) {
        if (cancelled) return;
        console.error('[ScenePreview] load error', err);
        setError('Could not load preview. Check the panorama URL.');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [panoramaUrl, startYaw, startPitch]);

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
      </div>
      <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-800">
        Preview only — drag to check how the scene looks. Use the yaw/pitch fields above to set where a learner starts looking.
      </p>
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
