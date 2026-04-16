'use client';

// components/academy/VideoPlayer.tsx
// Enhanced video player with chapter markers, transcript sync, playback speed.
// Mirrors AudioPlayer UX but wraps a <video> element.

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  ListMusic, FileText, ChevronDown, ChevronUp, Maximize, Minimize,
} from 'lucide-react';
import TranscriptPanel, { type TranscriptSegment } from './TranscriptPanel';

interface VideoChapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
}

interface VideoPlayerProps {
  src: string;
  chapters?: VideoChapter[] | null;
  transcript?: TranscriptSegment[] | null;
  onEnded?: () => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ src, chapters, transcript, onEnded }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoaded = () => setDuration(video.duration);
    const onEnd = () => { setPlaying(false); onEnded?.(); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('ended', onEnd);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [onEnded]);

  // Track fullscreen changes
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) { video.pause(); } else { video.play(); }
  }, [playing]);

  function seekTo(time: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);
  }

  function cycleSpeed() {
    const video = videoRef.current;
    if (!video) return;
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    video.playbackRate = next;
    setSpeed(next);
  }

  function skipBy(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    seekTo(Math.max(0, Math.min(duration, video.currentTime + seconds)));
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !muted;
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
      {/* Video element */}
      <div className="relative aspect-video bg-black cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          className="w-full h-full"
        />
        {/* Play overlay when paused */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="p-4 bg-fuchsia-600/90 rounded-full">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </div>
        )}
        {/* Chapter label overlay */}
        {currentChapter && (
          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/70 rounded-lg text-xs text-white font-medium backdrop-blur-sm">
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
            className="absolute top-0 left-0 h-full bg-fuchsia-500 rounded-full transition-[width] duration-100"
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

          <button onClick={() => skipBy(-15)} className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition" aria-label="Skip back 15 seconds" title="Skip back 15 seconds">
            <SkipBack className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            onClick={togglePlay}
            className="min-h-11 min-w-11 flex items-center justify-center bg-fuchsia-600 text-white rounded-full hover:bg-fuchsia-700 transition shrink-0"
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4 ml-0.5" aria-hidden="true" />}
          </button>

          <button onClick={() => skipBy(30)} className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition" aria-label="Skip forward 30 seconds" title="Skip forward 30 seconds">
            <SkipForward className="w-4 h-4" aria-hidden="true" />
          </button>

          <span className="text-xs text-gray-400 tabular-nums w-12 shrink-0 text-right">{formatTime(duration)}</span>

          <div className="flex-1" />

          <button
            onClick={cycleSpeed}
            className="min-h-11 px-2 text-xs font-semibold text-gray-300 bg-gray-800 rounded-lg hover:text-white hover:bg-gray-700 transition tabular-nums min-w-10.5"
            aria-label={`Playback speed ${speed}x`}
            title={`Playback speed (click to change from ${speed}x)`}
          >
            {speed}x
          </button>

          <button onClick={toggleMute} className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
          </button>

          <button onClick={toggleFullscreen} className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            {isFullscreen ? <Minimize className="w-4 h-4" aria-hidden="true" /> : <Maximize className="w-4 h-4" aria-hidden="true" />}
          </button>

          {hasChapters && (
            <button
              onClick={() => setShowChapters((s) => !s)}
              className={`min-h-11 min-w-11 flex items-center justify-center rounded-lg transition ${showChapters ? 'text-fuchsia-400 bg-fuchsia-900/30' : 'text-gray-400 hover:text-white'}`}
              aria-label={showChapters ? 'Hide chapter markers panel' : 'Show chapter markers panel'}
              aria-expanded={showChapters}
              title={showChapters ? 'Hide chapter markers' : 'Show chapter markers'}
            >
              <ListMusic className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {hasTranscript && (
            <button
              onClick={() => setShowTranscript((s) => !s)}
              className={`min-h-11 min-w-11 flex items-center justify-center rounded-lg transition ${showTranscript ? 'text-fuchsia-400 bg-fuchsia-900/30' : 'text-gray-400 hover:text-white'}`}
              aria-label={showTranscript ? 'Hide transcript panel' : 'Show transcript panel'}
              aria-expanded={showTranscript}
              title={showTranscript ? 'Hide transcript' : 'Show transcript'}
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
                      ? 'bg-fuchsia-900/30 text-fuchsia-300'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <span className="tabular-nums text-xs shrink-0 w-10 text-right">{formatTime(ch.startTime)}</span>
                  <span className="flex-1 truncate">{ch.title}</span>
                  {isCurrent && <Play className="w-3 h-3 text-fuchsia-400 shrink-0" aria-hidden="true" />}
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
        <TranscriptPanel
          transcript={transcript!}
          currentTime={currentTime}
          onSeek={seekTo}
          onCollapse={() => setShowTranscript(false)}
        />
      )}
    </div>
  );
}
