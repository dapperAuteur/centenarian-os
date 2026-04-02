'use client';

// components/academy/YouTubePlayer.tsx
// Branded YouTube player with custom controls overlay (hides native YouTube UI).
// Uses the YouTube IFrame Player API for programmatic control.
// Accepts a theme prop for cross-app reuse (CentOS, WorkWitUS, TourWitUS, etc.).

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  ListMusic, FileText, ChevronDown, ChevronUp, Maximize, Minimize,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VideoChapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
}

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
}

export interface YouTubePlayerTheme {
  /** Progress bar fill + active chapter highlight (Tailwind class) */
  progressBar: string;
  /** Play button bg (Tailwind class) */
  playButton: string;
  /** Play button hover bg (Tailwind class) */
  playButtonHover: string;
  /** Active toggle accent (Tailwind class for text) */
  accent: string;
  /** Active toggle bg (Tailwind class) */
  accentBg: string;
  /** Large play overlay bg (Tailwind class) */
  overlayPlay: string;
  /** Chapter label active text (Tailwind class) */
  chapterActive: string;
  /** Chapter label active bg (Tailwind class) */
  chapterActiveBg: string;
}

export const CENTENARIAN_THEME: YouTubePlayerTheme = {
  progressBar: 'bg-fuchsia-500',
  playButton: 'bg-fuchsia-600',
  playButtonHover: 'hover:bg-fuchsia-700',
  accent: 'text-fuchsia-400',
  accentBg: 'bg-fuchsia-900/30',
  overlayPlay: 'bg-fuchsia-600/90',
  chapterActive: 'text-fuchsia-300',
  chapterActiveBg: 'bg-fuchsia-900/30',
};

export interface YouTubePlayerProps {
  videoId: string;
  chapters?: VideoChapter[] | null;
  transcript?: TranscriptSegment[] | null;
  onEnded?: () => void;
  onTimeUpdate?: (seconds: number) => void;
  theme?: YouTubePlayerTheme;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Global IFrame API loader (singleton) ───────────────────────────────────

let ytApiLoaded = false;
let ytApiLoading = false;
const ytApiCallbacks: (() => void)[] = [];

function loadYouTubeApi(): Promise<void> {
  if (ytApiLoaded && window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    ytApiCallbacks.push(resolve);
    if (ytApiLoading) return;
    ytApiLoading = true;

    // YouTube API calls this global callback when ready
    window.onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true;
      ytApiCallbacks.forEach((cb) => cb());
      ytApiCallbacks.length = 0;
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function YouTubePlayer({
  videoId,
  chapters,
  transcript,
  onEnded,
  onTimeUpdate,
  theme = CENTENARIAN_THEME,
}: YouTubePlayerProps) {
  const playerDivRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sortedChapters = chapters?.slice().sort((a, b) => a.startTime - b.startTime) ?? [];
  const hasChapters = sortedChapters.length > 0;
  const hasTranscript = transcript && transcript.length > 0;

  const currentChapter = sortedChapters.find(
    (ch) => currentTime >= ch.startTime && currentTime < ch.endTime,
  );

  const activeSegmentIndex = transcript?.findIndex(
    (seg) => currentTime >= seg.startTime && currentTime < seg.endTime,
  ) ?? -1;

  // ── Initialize YouTube player ──────────────────────────────────────────

  useEffect(() => {
    let destroyed = false;

    loadYouTubeApi().then(() => {
      if (destroyed || !playerDivRef.current) return;

      playerRef.current = new window.YT.Player(playerDivRef.current, {
        videoId,
        playerVars: {
          controls: 0,        // hide native controls
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,  // hide annotations
          disablekb: 1,       // disable YouTube keyboard shortcuts
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: YT.PlayerEvent) => {
            if (destroyed) return;
            setDuration(e.target.getDuration());
            setReady(true);
          },
          onStateChange: (e: YT.OnStateChangeEvent) => {
            if (destroyed) return;
            const state = e.data;
            if (state === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
            } else if (state === window.YT.PlayerState.PAUSED) {
              setPlaying(false);
            } else if (state === window.YT.PlayerState.ENDED) {
              setPlaying(false);
              onEnded?.();
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (pollRef.current) clearInterval(pollRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // Only re-create player when videoId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // ── Poll currentTime (YouTube API has no timeupdate event) ─────────────

  useEffect(() => {
    if (!ready) return;

    pollRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      const t = player.getCurrentTime();
      setCurrentTime(t);
      onTimeUpdate?.(t);
    }, 500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ready, onTimeUpdate]);

  // ── Auto-scroll transcript ─────────────────────────────────────────────

  useEffect(() => {
    if (!showTranscript || activeSegmentIndex < 0) return;
    const el = transcriptRef.current?.querySelector(`[data-seg="${activeSegmentIndex}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeSegmentIndex, showTranscript]);

  // ── Track fullscreen changes ───────────────────────────────────────────

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Player controls ────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, [playing]);

  function seekTo(time: number) {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(time, true);
    setCurrentTime(time);
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);
  }

  function cycleSpeed() {
    const player = playerRef.current;
    if (!player) return;
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    player.setPlaybackRate(next);
    setSpeed(next);
  }

  function skipBy(seconds: number) {
    const player = playerRef.current;
    if (!player) return;
    const t = player.getCurrentTime();
    seekTo(Math.max(0, Math.min(duration, t + seconds)));
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    if (muted) {
      player.unMute();
    } else {
      player.mute();
    }
    setMuted(!muted);
  }

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div ref={containerRef} className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl overflow-hidden mb-6">
      {/* YouTube iframe container */}
      <div className="relative aspect-video bg-black">
        <div ref={playerDivRef} className="w-full h-full" />

        {/* Clickable overlay for play/pause (sits above iframe) */}
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={togglePlay}
          aria-label={playing ? 'Pause video' : 'Play video'}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePlay(); } }}
        />

        {/* Play overlay when paused */}
        {!playing && ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20 pointer-events-none">
            <div className={`p-4 ${theme.overlayPlay} rounded-full`}>
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </div>
        )}

        {/* Loading state */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
            <div className="animate-pulse text-gray-500 text-sm">Loading player…</div>
          </div>
        )}

        {/* Chapter label overlay */}
        {currentChapter && (
          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/70 rounded-lg text-xs text-white font-medium backdrop-blur-sm z-20 pointer-events-none">
            {currentChapter.title}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-3 sm:p-4">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="relative h-2 bg-gray-800 rounded-full cursor-pointer mb-3 group"
          onClick={handleProgressClick}
        >
          <div
            className={`absolute top-0 left-0 h-full ${theme.progressBar} rounded-full transition-[width] duration-100`}
            style={{ width: `${progress}%` }}
          />
          {sortedChapters.map((ch) => {
            const pos = duration > 0 ? (ch.startTime / duration) * 100 : 0;
            return (
              <div
                key={ch.id}
                className="absolute top-0 w-0.5 h-full bg-gray-600 group-hover:bg-gray-500"
                style={{ left: `${pos}%` }}
                title={ch.title}
              />
            );
          })}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition pointer-events-none"
            style={{ left: `${progress}%`, marginLeft: '-7px' }}
          />
        </div>

        {/* Time + controls row */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs text-gray-400 tabular-nums w-12 shrink-0">{formatTime(currentTime)}</span>

          <button onClick={() => skipBy(-15)} className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition" aria-label="Skip back 15 seconds">
            <SkipBack className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            onClick={togglePlay}
            className={`min-h-11 min-w-11 flex items-center justify-center ${theme.playButton} text-white rounded-full ${theme.playButtonHover} transition shrink-0`}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4 ml-0.5" aria-hidden="true" />}
          </button>

          <button onClick={() => skipBy(30)} className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition" aria-label="Skip forward 30 seconds">
            <SkipForward className="w-4 h-4" aria-hidden="true" />
          </button>

          <span className="text-xs text-gray-400 tabular-nums w-12 shrink-0 text-right">{formatTime(duration)}</span>

          <div className="flex-1" />

          <button
            onClick={cycleSpeed}
            className="min-h-11 px-2 text-xs font-semibold text-gray-300 bg-gray-800 rounded-lg hover:text-white hover:bg-gray-700 transition tabular-nums min-w-10.5"
            aria-label={`Playback speed ${speed}x`}
          >
            {speed}x
          </button>

          <button onClick={toggleMute} className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition" aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
          </button>

          <button onClick={toggleFullscreen} className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            {isFullscreen ? <Minimize className="w-4 h-4" aria-hidden="true" /> : <Maximize className="w-4 h-4" aria-hidden="true" />}
          </button>

          {hasChapters && (
            <button
              onClick={() => setShowChapters((s) => !s)}
              className={`min-h-11 min-w-11 flex items-center justify-center rounded-lg transition ${showChapters ? `${theme.accent} ${theme.accentBg}` : 'text-gray-400 hover:text-white'}`}
              aria-label={showChapters ? 'Hide chapters' : 'Show chapters'}
              aria-expanded={showChapters}
            >
              <ListMusic className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {hasTranscript && (
            <button
              onClick={() => setShowTranscript((s) => !s)}
              className={`min-h-11 min-w-11 flex items-center justify-center rounded-lg transition ${showTranscript ? `${theme.accent} ${theme.accentBg}` : 'text-gray-400 hover:text-white'}`}
              aria-label={showTranscript ? 'Hide transcript' : 'Show transcript'}
              aria-expanded={showTranscript}
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Chapters panel */}
      {hasChapters && showChapters && (
        <div className="border-t border-gray-800">
          <button
            onClick={() => setShowChapters(false)}
            className="w-full flex items-center justify-between px-4 sm:px-6 min-h-11 text-xs text-gray-300 hover:text-white transition"
            aria-label="Collapse chapters"
            aria-expanded="true"
          >
            <span className="font-semibold uppercase tracking-wide">Chapters ({sortedChapters.length})</span>
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <div className="px-4 sm:px-6 pb-4 space-y-1 max-h-60 overflow-y-auto">
            {sortedChapters.map((ch) => {
              const isCurrent = currentChapter?.id === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => seekTo(ch.startTime)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    isCurrent
                      ? `${theme.chapterActiveBg} ${theme.chapterActive}`
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <span className="tabular-nums text-xs shrink-0 w-10 text-right">{formatTime(ch.startTime)}</span>
                  <span className="flex-1 truncate">{ch.title}</span>
                  {isCurrent && <Play className={`w-3 h-3 ${theme.accent} shrink-0`} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasChapters && !showChapters && (
        <button
          onClick={() => setShowChapters(true)}
          className="w-full border-t border-gray-800 flex items-center justify-between px-4 sm:px-6 min-h-11 text-xs text-gray-400 hover:text-gray-200 transition"
          aria-label="Expand chapters"
          aria-expanded="false"
        >
          <span>{sortedChapters.length} chapters</span>
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}

      {/* Transcript panel */}
      {hasTranscript && showTranscript && (
        <div className="border-t border-gray-800">
          <button
            onClick={() => setShowTranscript(false)}
            className="w-full flex items-center justify-between px-4 sm:px-6 min-h-11 text-xs text-gray-300 hover:text-white transition"
            aria-label="Collapse transcript"
            aria-expanded="true"
          >
            <span className="font-semibold uppercase tracking-wide">Transcript</span>
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <div ref={transcriptRef} className="px-4 sm:px-6 pb-4 max-h-72 overflow-y-auto space-y-0.5">
            {transcript!.map((seg, i) => (
              <button
                key={i}
                data-seg={i}
                onClick={() => seekTo(seg.startTime)}
                className={`w-full text-left flex gap-3 px-2 py-1.5 rounded-lg text-sm transition ${
                  i === activeSegmentIndex
                    ? `${theme.accentBg} text-white`
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <span className="tabular-nums text-xs shrink-0 w-10 text-right mt-0.5 opacity-60">{formatTime(seg.startTime)}</span>
                <span className="flex-1">{seg.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
