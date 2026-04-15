'use client';

// components/academy/AudioPlayer.tsx
// Enhanced audio player with chapter markers, transcript sync, playback speed.
// Replaces basic <audio controls> for audio lessons.
// Uses native HTML5 Audio API — no external dependencies.

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  ListMusic, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';

interface AudioChapter {
  id: string;
  title: string;
  startTime: number; // seconds
  endTime: number;   // seconds
}

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
}

interface AudioPlayerProps {
  src: string;
  chapters?: AudioChapter[] | null;
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

export default function AudioPlayer({ src, chapters, transcript, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showChapters, setShowChapters] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  const sortedChapters = chapters?.slice().sort((a, b) => a.startTime - b.startTime) ?? [];
  const hasChapters = sortedChapters.length > 0;
  const hasTranscript = transcript && transcript.length > 0;

  // Current chapter based on currentTime
  const currentChapter = sortedChapters.find(
    (ch) => currentTime >= ch.startTime && currentTime < ch.endTime,
  );

  // Current transcript segment
  const activeSegmentIndex = transcript?.findIndex(
    (seg) => currentTime >= seg.startTime && currentTime < seg.endTime,
  ) ?? -1;

  // Time update listener
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnd = () => { setPlaying(false); onEnded?.(); };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnd);
    };
  }, [onEnded]);

  // Auto-scroll transcript to active segment
  useEffect(() => {
    if (!showTranscript || activeSegmentIndex < 0) return;
    const el = transcriptRef.current?.querySelector(`[data-seg="${activeSegmentIndex}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeSegmentIndex, showTranscript]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); } else { audio.play(); }
    setPlaying(!playing);
  }, [playing]);

  function seekTo(time: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);
  }

  function cycleSpeed() {
    const audio = audioRef.current;
    if (!audio) return;
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    audio.playbackRate = next;
    setSpeed(next);
  }

  function skipBy(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    seekTo(Math.max(0, Math.min(duration, audio.currentTime + seconds)));
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !muted;
    setMuted(!muted);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl overflow-hidden mb-6">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Player controls */}
      <div className="p-4 sm:p-6">
        {/* Current chapter label */}
        {currentChapter && (
          <p className="text-xs text-fuchsia-400 font-medium mb-2 truncate">{currentChapter.title}</p>
        )}

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
          {/* Chapter markers on progress bar */}
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
          {/* Scrubber dot */}
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
            {playing ? <Pause className="w-5 h-5" aria-hidden="true" /> : <Play className="w-5 h-5 ml-0.5" aria-hidden="true" />}
          </button>

          <button onClick={() => skipBy(30)} className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition" aria-label="Skip forward 30 seconds" title="Skip forward 30 seconds">
            <SkipForward className="w-4 h-4" aria-hidden="true" />
          </button>

          <span className="text-xs text-gray-400 tabular-nums w-12 shrink-0 text-right">{formatTime(duration)}</span>

          <div className="flex-1" />

          {/* Speed */}
          <button
            onClick={cycleSpeed}
            className="min-h-11 px-2 text-xs font-semibold text-gray-300 bg-gray-800 rounded-lg hover:text-white hover:bg-gray-700 transition tabular-nums min-w-10.5"
            aria-label={`Playback speed ${speed}x`}
            title={`Playback speed (click to change from ${speed}x)`}
          >
            {speed}x
          </button>

          {/* Mute */}
          <button onClick={toggleMute} className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
          </button>

          {/* Toggle buttons */}
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

      {/* Collapsed chapters hint */}
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
                    ? 'bg-fuchsia-900/20 text-white'
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
