'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Trash2, Loader2, RotateCcw } from 'lucide-react';

interface AudioRecorderProps {
  onUploaded: (url: string, publicId: string) => void;
  onRemoved: () => void;
  existingUrl?: string | null;
  /** Render as icon-only button (no label text) */
  compact?: boolean;
  /** Custom idle-button label (default: "Record Audio") */
  label?: string;
  /** Auto-stop recording after N seconds */
  maxDuration?: number;
  /** Skip preview — upload immediately when recording stops */
  autoUpload?: boolean;
  /** Dark mode styling for dark-themed pages */
  variant?: 'light' | 'dark';
  /** Outer wrapper className override */
  className?: string;
}

export default function AudioRecorder({
  onUploaded,
  onRemoved,
  existingUrl,
  compact = false,
  label = 'Record Audio',
  maxDuration,
  autoUpload = false,
  variant = 'light',
  className,
}: AudioRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'preview' | 'uploading' | 'done'>(
    existingUrl ? 'done' : 'idle',
  );
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoUploadRef = useRef(autoUpload);
  autoUploadRef.current = autoUpload;

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  const dark = variant === 'dark';

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  useEffect(() => () => cleanup(), [cleanup]);

  const doUpload = useCallback(async (audioChunks: Blob[]) => {
    if (!cloudName || !uploadPreset) {
      setError('Cloudinary is not configured');
      return;
    }
    if (audioChunks.length === 0) return;

    setState('uploading');
    setError('');

    try {
      const mimeType = audioChunks[0].type || 'audio/webm';
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(audioChunks, { type: mimeType });
      const file = new File([blob], `audio-note.${ext}`, { type: mimeType });

      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        { method: 'POST', body: form },
      );
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      if (!data.secure_url) throw new Error('No URL returned');

      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setState('done');
      onUploaded(data.secure_url, data.public_id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setState('preview');
    }
  }, [cloudName, uploadPreset, onUploaded]);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.current = recorder;
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (autoUploadRef.current) {
          doUpload([...chunks.current]);
        } else {
          const blob = new Blob(chunks.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setState('preview');
        }
      };

      recorder.start();
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setError('Microphone access denied');
    }
  };

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorder.current?.stop();
  }, []);

  // Auto-stop at maxDuration
  useEffect(() => {
    if (maxDuration && state === 'recording' && elapsed >= maxDuration) {
      stopRecording();
    }
  }, [maxDuration, state, elapsed, stopRecording]);

  const uploadAudio = () => doUpload([...chunks.current]);

  const reset = () => {
    cleanup();
    setBlobUrl(null);
    setElapsed(0);
    setState('idle');
    onRemoved();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Style helpers
  const btnBorder = dark
    ? 'text-gray-300 border border-gray-600 hover:bg-gray-700'
    : 'text-gray-600 border border-gray-200 hover:bg-gray-50';
  const btnPrimary = 'text-white bg-fuchsia-600 hover:bg-fuchsia-700';
  const textMuted = dark ? 'text-gray-400' : 'text-gray-500';
  const textError = 'text-red-500';

  return (
    <div className={className || 'space-y-2'}>
      {state === 'idle' && (
        compact ? (
          <button
            type="button"
            onClick={startRecording}
            className={`flex items-center justify-center min-h-11 min-w-11 rounded-xl transition ${btnBorder}`}
            aria-label={label}
          >
            <Mic className="w-4 h-4 text-red-500" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            className={`flex items-center gap-2 px-3 py-2 min-h-11 text-sm rounded-xl transition ${btnBorder}`}
            aria-label={label}
          >
            <Mic className="w-4 h-4 text-red-500" aria-hidden="true" />
            {label}
          </button>
        )
      )}

      {state === 'recording' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-red-600" role="status">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true" />
            {maxDuration
              ? `${formatTime(Math.max(0, maxDuration - elapsed))} left`
              : `Recording ${formatTime(elapsed)}`}
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-2 min-h-11 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition"
            aria-label="Stop recording"
          >
            <Square className="w-3 h-3" aria-hidden="true" />
            Stop
          </button>
        </div>
      )}

      {state === 'preview' && blobUrl && (
        <div className="flex items-center gap-2 flex-wrap">
          <audio src={blobUrl} controls className="h-10 flex-1 min-w-[200px]" />
          <button
            type="button"
            onClick={startRecording}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-11 text-sm rounded-xl transition ${btnBorder}`}
            aria-label="Re-record audio"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={uploadAudio}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-11 text-sm font-medium rounded-xl transition ${btnPrimary}`}
          >
            Save Audio
          </button>
        </div>
      )}

      {state === 'uploading' && (
        <div className={`flex items-center gap-2 text-sm ${textMuted}`} role="status" aria-label="Uploading audio">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Uploading...
        </div>
      )}

      {state === 'done' && (existingUrl || blobUrl) && (
        <div className="flex items-center gap-2">
          <audio src={existingUrl || blobUrl || ''} controls className="h-10 flex-1 min-w-[200px]" />
          <button
            type="button"
            onClick={reset}
            className={`flex items-center justify-center min-h-11 min-w-11 ${dark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-600'} transition`}
            aria-label="Remove audio"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {error && <p className={`text-xs ${textError}`} role="alert">{error}</p>}
    </div>
  );
}
