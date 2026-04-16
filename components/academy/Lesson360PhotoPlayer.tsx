'use client';

// components/academy/Lesson360PhotoPlayer.tsx
// Immersive 360° still-image player for Academy lessons. Wraps Photo Sphere
// Viewer with the default EquirectangularAdapter (no VideoPlugin, no progress
// tracking — images have no duration). PSV modules are dynamic-imported inside
// useEffect so the chunk only loads when a learner opens a 360 lesson.
//
// Mirrors Lesson360VideoPlayer's structure but stripped down for stills.
// Calls onReady() once the viewer mounts so the lesson can be marked complete
// immediately (there's nothing to wait for).

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { resolveAssetUrl, releaseResolvedUrl } from '@/lib/offline/asset-resolver';

interface Lesson360PhotoPlayerProps {
  src: string;
  /**
   * Optional 2D poster image URL shown while PSV loads and as a
   * no-WebGL fallback. Usually identical to src for photo lessons.
   */
  posterUrl?: string | null;
  /** Fires once when the viewer is ready. Use to mark the lesson complete. */
  onReady?: () => void;
}

function Lesson360PhotoPlayerInner({ src, posterUrl, onReady }: Lesson360PhotoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: import('@photo-sphere-viewer/core').Viewer | null = null;
    let cancelled = false;
    let resolvedSrc = '';

    (async () => {
      try {
        const { Viewer } = await import('@photo-sphere-viewer/core');
        const { GyroscopePlugin } = await import('@photo-sphere-viewer/gyroscope-plugin');
        await import('@photo-sphere-viewer/core/index.css');

        if (cancelled || !containerRef.current) return;

        // Use the offline-cached blob URL if this asset has been saved
        // for offline; otherwise resolveAssetUrl returns the original URL.
        resolvedSrc = await resolveAssetUrl(src);
        if (cancelled) return;

        viewer = new Viewer({
          container: containerRef.current,
          panorama: resolvedSrc,
          keyboard: 'always',
          navbar: ['zoom', 'caption', 'gyroscope', 'fullscreen'],
          plugins: [GyroscopePlugin],
        });

        viewer.addEventListener('ready', () => {
          if (cancelled) return;
          setLoading(false);
          onReady?.();
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load 360 photo player', err);
        setError('Could not load the 360° photo player. Try refreshing the page.');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      viewer?.destroy();
      releaseResolvedUrl(resolvedSrc);
    };
  }, [src, onReady]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl overflow-hidden mb-6">
      <div className="relative">
        <div
          ref={containerRef}
          role="application"
          aria-label="360 degree photo. Drag to look around. Use arrow keys to pan, plus and minus to zoom."
          className="w-full bg-black"
          style={{ height: 'min(70vh, 600px)' }}
        />
        {loading && !error && posterUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={posterUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {loading && !error && (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center bg-black/60 text-white"
          >
            <span className="text-sm">Loading 360° photo…</span>
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
      </div>
      <p className="px-4 sm:px-6 py-3 text-xs text-gray-400 border-t border-gray-800">
        Drag to look around. Arrow keys pan, <kbd className="px-1 py-0.5 bg-gray-800 rounded">+</kbd>/<kbd className="px-1 py-0.5 bg-gray-800 rounded">−</kbd> zoom. On mobile, tap the gyroscope icon to look around by moving your phone.
      </p>
    </div>
  );
}

const Lesson360PhotoPlayer = dynamic(() => Promise.resolve(Lesson360PhotoPlayerInner), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl mb-6 flex items-center justify-center text-white text-sm"
      style={{ height: 'min(70vh, 600px)' }}
    >
      Loading 360° photo…
    </div>
  ),
});

export default Lesson360PhotoPlayer;
