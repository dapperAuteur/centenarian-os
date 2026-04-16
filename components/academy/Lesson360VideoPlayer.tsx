'use client';

// components/academy/Lesson360VideoPlayer.tsx
// Immersive 360° video player for Academy lessons. Wraps Photo Sphere Viewer
// with the EquirectangularVideoAdapter so learners can pan/look around inside
// an equirectangular MP4. PSV modules are dynamic-imported inside useEffect so
// the ~140KB chunk only loads when a learner actually opens a 360 lesson —
// other Academy routes pay nothing.
//
// Reference port from plans/wanderlearn/virtual-tour-kit/components/VirtualTour/Video360Player.tsx,
// adapted to CentenarianOS dark container + a11y conventions (CLAUDE.md).

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import TranscriptPanel, { type TranscriptSegment } from './TranscriptPanel';

interface Lesson360VideoPlayerProps {
  src: string;
  autoplay?: boolean;
  /**
   * Optional 2D poster image URL shown under the PSV canvas while the
   * heavy player chunk loads and as a no-WebGL fallback. Generated from
   * the content URL at upload time via lib/cloudinary/poster.ts.
   */
  posterUrl?: string | null;
  /**
   * Optional timestamped transcript. When present, a toggle button
   * appears that opens the shared TranscriptPanel below the player.
   */
  transcript?: TranscriptSegment[] | null;
  /** Fires whenever the underlying video time updates (~4Hz). Use to upsert lesson_progress. */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Fires when the video ends. Use to mark the lesson complete. */
  onEnded?: () => void;
}

function Lesson360VideoPlayerInner({
  src,
  autoplay = false,
  posterUrl,
  transcript,
  onTimeUpdate,
  onEnded,
}: Lesson360VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoPluginRef = useRef<{ setTime: (t: number) => void } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const hasTranscript = !!(transcript && transcript.length > 0);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: import('@photo-sphere-viewer/core').Viewer | null = null;
    let cancelled = false;
    let endedFired = false;

    (async () => {
      try {
        const { Viewer } = await import('@photo-sphere-viewer/core');
        const { VideoPlugin } = await import('@photo-sphere-viewer/video-plugin');
        const { EquirectangularVideoAdapter } = await import(
          '@photo-sphere-viewer/equirectangular-video-adapter'
        );
        const { GyroscopePlugin } = await import('@photo-sphere-viewer/gyroscope-plugin');
        await import('@photo-sphere-viewer/core/index.css');
        await import('@photo-sphere-viewer/video-plugin/index.css');

        if (cancelled || !containerRef.current) return;

        viewer = new Viewer({
          container: containerRef.current,
          adapter: EquirectangularVideoAdapter,
          panorama: { source: src },
          keyboard: 'always',
          navbar: [
            'videoPlay',
            'videoVolume',
            'videoTime',
            'caption',
            'gyroscope',
            'fullscreen',
          ],
          plugins: [
            [VideoPlugin, { autoplay, muted: autoplay }],
            GyroscopePlugin,
          ],
        });

        const videoPlugin = viewer.getPlugin<InstanceType<typeof VideoPlugin>>(VideoPlugin);
        if (videoPlugin) {
          // Stash so the transcript panel can call setTime to seek.
          videoPluginRef.current = videoPlugin;
        }

        viewer.addEventListener('ready', () => {
          if (!cancelled) setLoading(false);
        });

        videoPlugin?.addEventListener('progress', (e) => {
          if (cancelled) return;
          setCurrentTime(e.time);
          onTimeUpdate?.(e.time, e.duration);
          if (!endedFired && e.duration > 0 && e.progress >= 1) {
            endedFired = true;
            onEnded?.();
          }
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load 360 video player', err);
        setError('Could not load the 360° video player. Try refreshing the page.');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      videoPluginRef.current = null;
      viewer?.destroy();
    };
  }, [src, autoplay, onTimeUpdate, onEnded]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl overflow-hidden mb-6">
      <div className="relative">
        <div
          ref={containerRef}
          role="application"
          aria-label="360 degree video player. Drag to look around. Use arrow keys to pan, plus and minus to zoom."
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
            <span className="text-sm">Loading 360° video…</span>
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
        {/* Transcript toggle — top-right corner, only when a transcript is provided */}
        {hasTranscript && !loading && !error && (
          <button
            type="button"
            onClick={() => setShowTranscript((s) => !s)}
            className={`absolute top-3 right-3 min-h-11 min-w-11 flex items-center justify-center rounded-lg transition backdrop-blur-sm ${
              showTranscript
                ? 'text-fuchsia-400 bg-fuchsia-900/40 border border-fuchsia-700'
                : 'text-gray-200 bg-gray-900/80 border border-gray-700 hover:text-white'
            }`}
            aria-label={showTranscript ? 'Hide transcript panel' : 'Show transcript panel'}
            aria-expanded={showTranscript}
            title={showTranscript ? 'Hide transcript' : 'Show transcript'}
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="px-4 sm:px-6 py-3 text-xs text-gray-400 border-t border-gray-800">
        Drag to look around. Arrow keys pan, <kbd className="px-1 py-0.5 bg-gray-800 rounded">+</kbd>/<kbd className="px-1 py-0.5 bg-gray-800 rounded">−</kbd> zoom. On mobile, tap the gyroscope icon to look around by moving your phone.
      </p>
      {hasTranscript && showTranscript && (
        <TranscriptPanel
          transcript={transcript!}
          currentTime={currentTime}
          onSeek={(s) => videoPluginRef.current?.setTime(s)}
          onCollapse={() => setShowTranscript(false)}
        />
      )}
    </div>
  );
}

const Lesson360VideoPlayer = dynamic(() => Promise.resolve(Lesson360VideoPlayerInner), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl mb-6 flex items-center justify-center text-white text-sm"
      style={{ height: 'min(70vh, 600px)' }}
    >
      Loading 360° video…
    </div>
  ),
});

export default Lesson360VideoPlayer;
