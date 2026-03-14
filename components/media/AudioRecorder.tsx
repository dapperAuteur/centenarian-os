'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Trash2, Loader2, RotateCcw } from 'lucide-react';

interface AudioRecorderProps {
  onUploaded: (url: string, publicId: string) => void;
  onRemoved: () => void;
  existingUrl?: string | null;
}

export default function AudioRecorder({ onUploaded, onRemoved, existingUrl }: AudioRecorderProps) {
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

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  useEffect(() => () => cleanup(), [cleanup]);

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
        const blob = new Blob(chunks.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setState('preview');
      };

      recorder.start();
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setError('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorder.current?.stop();
  };

  const uploadAudio = async () => {
    if (!cloudName || !uploadPreset) {
      setError('Cloudinary is not configured');
      return;
    }
    if (chunks.current.length === 0) return;

    setState('uploading');
    setError('');

    try {
      const mimeType = chunks.current[0].type || 'audio/webm';
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks.current, { type: mimeType });
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

      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setState('done');
      onUploaded(data.secure_url, data.public_id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setState('preview');
    }
  };

  const reset = () => {
    cleanup();
    setBlobUrl(null);
    setElapsed(0);
    setState('idle');
    onRemoved();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-2">
      {state === 'idle' && (
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center gap-2 px-3 py-2 min-h-11 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          aria-label="Record audio note"
        >
          <Mic className="w-4 h-4 text-red-500" aria-hidden="true" />
          Record Audio
        </button>
      )}

      {state === 'recording' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-red-600" role="status">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true" />
            Recording {formatTime(elapsed)}
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
            className="flex items-center gap-1.5 px-3 py-2 min-h-11 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            aria-label="Re-record audio"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={uploadAudio}
            className="flex items-center gap-1.5 px-3 py-2 min-h-11 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl transition"
          >
            Save Audio
          </button>
        </div>
      )}

      {state === 'uploading' && (
        <div className="flex items-center gap-2 text-sm text-gray-500" role="status" aria-label="Uploading audio">
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
            className="flex items-center justify-center min-h-11 min-w-11 text-gray-400 hover:text-red-600 transition"
            aria-label="Remove audio"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
