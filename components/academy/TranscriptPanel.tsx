'use client';

// components/academy/TranscriptPanel.tsx
// Shared transcript panel used by VideoPlayer, AudioPlayer, and
// Lesson360VideoPlayer. Lifts the panel JSX that was embedded inside
// VideoPlayer and AudioPlayer so all three surfaces render the same
// highlight + auto-scroll + click-to-seek experience.
//
// The parent owns the underlying media element — this component is
// a dumb renderer: given the transcript segments + the current playback
// time + a seekTo callback, it highlights the active segment, scrolls
// it into view, and calls seekTo when a segment is clicked.
//
// Accessibility: the active segment is announced via `aria-live="polite"`
// on the scroll container. Each segment is a button so keyboard users
// can Tab through them.

import { useEffect, useRef } from 'react';
import { ChevronUp } from 'lucide-react';

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
}

interface TranscriptPanelProps {
  transcript: TranscriptSegment[];
  currentTime: number;
  onSeek: (seconds: number) => void;
  /** Collapses the panel. Parent controls show/hide state via its own toggle button. */
  onCollapse: () => void;
  /** Show the "Collapse transcript" header row with a chevron. Defaults true. */
  showHeader?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TranscriptPanel({
  transcript,
  currentTime,
  onSeek,
  onCollapse,
  showHeader = true,
}: TranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSegmentIndex = transcript.findIndex(
    (seg) => currentTime >= seg.startTime && currentTime < seg.endTime,
  );

  useEffect(() => {
    if (activeSegmentIndex < 0) return;
    const el = containerRef.current?.querySelector(`[data-seg="${activeSegmentIndex}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeSegmentIndex]);

  return (
    <div className="border-t border-gray-800">
      {showHeader && (
        <button
          type="button"
          onClick={onCollapse}
          className="w-full flex items-center justify-between px-4 sm:px-6 min-h-11 text-xs text-gray-300 hover:text-white transition"
          aria-label="Collapse transcript"
          aria-expanded="true"
        >
          <span className="font-semibold uppercase tracking-wide">Transcript</span>
          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
      <div
        ref={containerRef}
        className="px-4 sm:px-6 pb-4 max-h-72 overflow-y-auto space-y-0.5"
        aria-live="polite"
      >
        {transcript.map((seg, i) => (
          <button
            key={i}
            type="button"
            data-seg={i}
            onClick={() => onSeek(seg.startTime)}
            className={`w-full text-left flex gap-3 px-2 py-1.5 rounded-lg text-sm transition ${
              i === activeSegmentIndex
                ? 'bg-fuchsia-900/20 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <span className="tabular-nums text-xs shrink-0 w-10 text-right mt-0.5 opacity-60">
              {formatTime(seg.startTime)}
            </span>
            <span className="flex-1">{seg.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
