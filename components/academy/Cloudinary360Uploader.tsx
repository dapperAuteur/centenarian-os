'use client';

// components/academy/Cloudinary360Uploader.tsx
// Signed Cloudinary upload widget for 360° lessons. Supports both equirectangular
// video (the plan 20 default — 500 MB cap, chunked over 20 MB) and equirectangular
// images (plan 21 — 25 MB cap, single-shot). Pass resourceType to switch modes.
//
// Uses the canonical /api/cloudinary/sign endpoint for signed uploads.

import { CldUploadWidget } from 'next-cloudinary';
import { Upload } from 'lucide-react';
import { useState } from 'react';

type MediaKind = 'video' | 'image';

interface Cloudinary360UploaderProps {
  onUploadSuccess: (url: string) => void;
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
  currentUrl,
  resourceType = 'video',
}: Cloudinary360UploaderProps) {
  const [error, setError] = useState<string | null>(null);
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
            const info = result.info as { secure_url: string };
            onUploadSuccess(info.secure_url);
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
      <p className="text-xs text-gray-500">{config.label.helper}</p>
    </div>
  );
}
