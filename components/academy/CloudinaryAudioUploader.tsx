'use client';

// components/academy/CloudinaryAudioUploader.tsx
// Signed Cloudinary upload widget for audio lessons. Mirrors
// Cloudinary360Uploader.tsx but stripped to the audio-specific config:
// no equirectangular ratio check, no poster URL derivation, no
// 360-camera filename heuristics.
//
// Quirk: Cloudinary serves audio under `resource_type: 'video'`. Don't
// try to use 'audio' or 'raw' here — uploads succeed with 'video' and
// the returned secure_url plays fine in the HTML5 <audio> element.
//
// Uses the canonical /api/cloudinary/sign endpoint for signed uploads
// (same one the 360 uploader and other Cloudinary surfaces use).

import { CldUploadWidget } from 'next-cloudinary';
import { Upload, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { logError } from '@/lib/error-logging';
import { suggestTitleFromFilename } from '@/lib/academy/camera-filename';

interface CloudinaryAudioUploaderProps {
  /** Fires on successful upload with the Cloudinary secure_url. */
  onUploadSuccess: (url: string) => void;
  /**
   * Fires after upload when the filename looks like it could become a
   * usable lesson title. Parent should apply only if the lesson title
   * is currently empty — never clobber an existing title.
   */
  onTitleSuggestion?: (title: string) => void;
  currentUrl?: string | null;
}

const AUDIO_CONFIG = {
  folder: 'academy/audio',
  // Cloudinary free-tier signed uploads cap at 100 MB. Larger files
  // need to be hosted externally and pasted into the Content URL field.
  maxFileSize: 100 * 1024 * 1024,
  maxChunkSize: 20 * 1024 * 1024,
  clientAllowedFormats: ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'opus'],
} as const;

export default function CloudinaryAudioUploader({
  onUploadSuccess,
  onTitleSuggestion,
  currentUrl,
}: CloudinaryAudioUploaderProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <CldUploadWidget
        signatureEndpoint="/api/cloudinary/sign"
        options={{
          // Cloudinary classifies audio under 'video'. This is required.
          resourceType: 'video',
          folder: AUDIO_CONFIG.folder,
          maxFileSize: AUDIO_CONFIG.maxFileSize,
          maxChunkSize: AUDIO_CONFIG.maxChunkSize,
          sources: ['local', 'url'],
          multiple: false,
          clientAllowedFormats: [...AUDIO_CONFIG.clientAllowedFormats],
        }}
        onSuccess={(result) => {
          if (result.event === 'success' && result.info && typeof result.info === 'object') {
            const info = result.info as {
              secure_url: string;
              public_id?: string;
              original_filename?: string;
              bytes?: number;
              duration?: number;
            };
            onUploadSuccess(info.secure_url);

            if (onTitleSuggestion) {
              const suggestion = suggestTitleFromFilename({ originalFilename: info.original_filename });
              if (suggestion) onTitleSuggestion(suggestion.title);
            }

            // Register in the teacher's media library so the asset shows
            // up in /dashboard/teaching/media and the Pick-from-library
            // modal. Fire-and-forget — if it fails the upload still
            // succeeded and the lesson still saves; the asset just won't
            // appear in the library.
            fetch('/api/academy/media', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cloudinary_public_id: info.public_id,
                cloudinary_resource_type: 'video',
                secure_url: info.secure_url,
                asset_kind: 'audio',
                name: info.original_filename || info.public_id || `Audio upload ${new Date().toLocaleString()}`,
                file_size_bytes: info.bytes ?? null,
                duration_seconds: info.duration ?? null,
                width: null,
                height: null,
              }),
            }).catch((err) => {
              logError(err, { module: 'CloudinaryAudioUploader', context: { op: 'register-asset' } });
            });
          }
        }}
        onError={(err) => {
          console.error('[CloudinaryAudioUploader] Upload error:', err);
          setError('Upload failed. Try a smaller file or paste a URL instead.');
        }}
      >
        {({ open }) => (
          <button
            type="button"
            onClick={() => {
              setError(null);
              open();
            }}
            className="min-h-11 w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-700 rounded-xl text-sm text-gray-300 hover:border-fuchsia-500 hover:text-fuchsia-300 transition"
            aria-label={currentUrl ? 'Replace audio file' : 'Upload audio file'}
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            {currentUrl ? 'Replace audio (up to 100 MB)' : 'Upload audio (up to 100 MB)'}
          </button>
        )}
      </CldUploadWidget>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          {error}
        </p>
      )}
      <p className="text-xs text-gray-500">
        MP3, M4A, WAV, AAC, OGG, or Opus &mdash; up to 100 MB (Cloudinary free-tier signed-upload cap). For larger files, host externally and paste the URL into the Content URL field above.
      </p>
    </div>
  );
}
