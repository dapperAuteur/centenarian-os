'use client';

// components/academy/Cloudinary360Uploader.tsx
// Signed Cloudinary upload widget for 360° lessons. Supports both equirectangular
// video (the plan 20 default — 500 MB cap, chunked over 20 MB) and equirectangular
// images (plan 21 — 25 MB cap, single-shot). Pass resourceType to switch modes.
//
// Uses the canonical /api/cloudinary/sign endpoint for signed uploads.

import { CldUploadWidget } from 'next-cloudinary';
import { AlertTriangle, Upload } from 'lucide-react';
import { useState } from 'react';
import { derivePosterUrl } from '@/lib/cloudinary/poster';
import { logError } from '@/lib/error-logging';
import type { AssetKind } from '@/lib/academy/media-types';
import { checkEquirectangularRatio, suggestTitleFromFilename } from '@/lib/academy/camera-filename';

type MediaKind = 'video' | 'image';

interface Cloudinary360UploaderProps {
  /**
   * Fires on successful upload. The posterUrl is a flat 2D thumbnail
   * derived from the Cloudinary URL (first-frame for videos, resized for
   * images). Save it alongside content_url so the player and catalog can
   * use it as a preview / no-WebGL fallback.
   */
  onUploadSuccess: (url: string, posterUrl: string | null) => void;
  /**
   * Fires after an upload when the filename matches a known 360° camera
   * pattern. Parent should apply the suggestion only when the lesson
   * title is empty — don't clobber a teacher's existing title.
   */
  onTitleSuggestion?: (title: string) => void;
  currentUrl?: string | null;
  /** Which kind of 360 media this uploader handles. Defaults to 'video'. */
  resourceType?: MediaKind;
}

const VIDEO_CONFIG = {
  folder: 'academy/360-videos',
  // Cloudinary free tier caps signed uploads at 100 MB total. The widget
  // rejects larger files even when chunked, so we surface the real limit
  // in the UI and keep this aligned. Teachers with larger 360 videos
  // should host them elsewhere and paste a URL into the content_url field.
  maxFileSize: 100 * 1024 * 1024,
  maxChunkSize: 20 * 1024 * 1024,
  // Accepts true 360 container formats. LRV was added earlier but removed:
  // LRV is the low-resolution FLAT proxy file that Insta360 / GoPro cameras
  // generate alongside the real recording — it is NOT equirectangular, so
  // Photo Sphere Viewer renders it as a stretched flat video with no pan.
  // INSV is kept because it IS the Insta360 original stitched 360 file.
  clientAllowedFormats: ['mp4', 'mov', 'webm', 'mkv', 'insv', 'm4v'],
  label: {
    upload: 'Upload 360° video (up to 100 MB)',
    replace: 'Replace 360° video',
    aria: (current: boolean) => (current ? 'Replace 360 video' : 'Upload 360 video'),
    helper: 'Equirectangular MP4, MOV, WebM, MKV, or INSV — up to 100 MB (Cloudinary free-tier cap). For larger files, host externally and paste the URL above. LRV proxy files are not 360° — export the stitched equirectangular file from Insta360 Studio first.',
  },
} as const;

const IMAGE_CONFIG = {
  folder: 'academy/360-photos',
  maxFileSize: 25 * 1024 * 1024,
  maxChunkSize: 25 * 1024 * 1024, // effectively single-shot; images are small
  clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  label: {
    upload: 'Upload 360° photo (up to 25 MB)',
    replace: 'Replace 360° photo',
    aria: (current: boolean) => (current ? 'Replace 360 photo' : 'Upload 360 photo'),
    helper: 'Equirectangular JPG / PNG / WebP.',
  },
} as const;

export default function Cloudinary360Uploader({
  onUploadSuccess,
  onTitleSuggestion,
  currentUrl,
  resourceType = 'video',
}: Cloudinary360UploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [ratioWarning, setRatioWarning] = useState<string | null>(null);
  const config = resourceType === 'image' ? IMAGE_CONFIG : VIDEO_CONFIG;

  return (
    <div className="space-y-2">
      <CldUploadWidget
        signatureEndpoint="/api/cloudinary/sign"
        options={{
          resourceType,
          folder: config.folder,
          maxFileSize: config.maxFileSize,
          maxChunkSize: config.maxChunkSize,
          sources: ['local', 'url'],
          multiple: false,
          clientAllowedFormats: [...config.clientAllowedFormats],
        }}
        onSuccess={(result) => {
          if (result.event === 'success' && result.info && typeof result.info === 'object') {
            const info = result.info as {
              secure_url: string;
              public_id?: string;
              resource_type?: string;
              original_filename?: string;
              bytes?: number;
              duration?: number;
              width?: number;
              height?: number;
            };
            const posterUrl = derivePosterUrl(info.secure_url, resourceType);
            onUploadSuccess(info.secure_url, posterUrl);

            // Equirectangular sanity check: a true 360° file has a 2:1
            // width:height ratio. Don't block the upload — some teachers
            // use 180° or partial-sphere files — but surface a warning so
            // they can catch the common "I forgot to stitch" mistake.
            const ratioState = checkEquirectangularRatio(info.width, info.height);
            if (ratioState === 'suspect') {
              setRatioWarning(
                `This file is ${info.width}×${info.height} (${(info.width! / info.height!).toFixed(2)}:1). Equirectangular 360° media should be 2:1 — if your preview looks stretched or frozen, export the stitched version from your camera's desktop app and re-upload.`,
              );
            } else {
              setRatioWarning(null);
            }

            // Filename-based title hint — parent decides whether to apply.
            if (onTitleSuggestion) {
              const suggestion = suggestTitleFromFilename({ originalFilename: info.original_filename });
              if (suggestion) onTitleSuggestion(suggestion.title);
            }

            // Register in the teacher's media library. Fire-and-forget —
            // if it fails the upload still succeeded and the lesson still
            // saves; the asset just won't appear in the library.
            const assetKind: AssetKind = resourceType === 'image' ? 'panorama_image' : 'panorama_video';
            fetch('/api/academy/media', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cloudinary_public_id: info.public_id,
                cloudinary_resource_type: resourceType,
                secure_url: info.secure_url,
                asset_kind: assetKind,
                name: info.original_filename || info.public_id || `Upload ${new Date().toLocaleString()}`,
                file_size_bytes: info.bytes ?? null,
                duration_seconds: info.duration ?? null,
                width: info.width ?? null,
                height: info.height ?? null,
              }),
            }).catch((err) => {
              logError(err, { module: 'Cloudinary360Uploader', context: { op: 'register-asset' } });
            });
          }
        }}
        onError={(err) => {
          console.error('[Cloudinary360Uploader] Upload error:', err);
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
            aria-label={config.label.aria(!!currentUrl)}
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            {currentUrl ? config.label.replace : config.label.upload}
          </button>
        )}
      </CldUploadWidget>
      {error && (
        <p role="alert" className="text-xs text-red-400">{error}</p>
      )}
      {ratioWarning && (
        <div
          role="alert"
          className="flex items-start gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-900/60 rounded-lg p-2.5"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{ratioWarning}</span>
        </div>
      )}
      <p className="text-xs text-gray-500">{config.label.helper}</p>
    </div>
  );
}
