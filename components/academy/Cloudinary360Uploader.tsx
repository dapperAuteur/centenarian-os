'use client';

// components/academy/Cloudinary360Uploader.tsx
// Signed Cloudinary upload widget for 360° video lessons. Wraps next-cloudinary's
// CldUploadWidget with a 500 MB file cap and 20 MB chunked upload so teachers can
// publish typical equirectangular MP4s (often 100–500 MB) directly from the lesson
// editor without leaving CentenarianOS.
//
// Uses /api/blog/upload as the signing endpoint — that route is a generic
// signing service, not blog-specific, and already gates on auth.

import { CldUploadWidget } from 'next-cloudinary';
import { Upload } from 'lucide-react';
import { useState } from 'react';

interface Cloudinary360UploaderProps {
  onUploadSuccess: (url: string) => void;
  currentUrl?: string | null;
}

const FOLDER = 'academy/360-videos';
const MAX_BYTES = 500 * 1024 * 1024;
const CHUNK_BYTES = 20 * 1024 * 1024;

export default function Cloudinary360Uploader({
  onUploadSuccess,
  currentUrl,
}: Cloudinary360UploaderProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <CldUploadWidget
        signatureEndpoint="/api/blog/upload"
        options={{
          resourceType: 'video',
          folder: FOLDER,
          maxFileSize: MAX_BYTES,
          maxChunkSize: CHUNK_BYTES,
          sources: ['local', 'url'],
          multiple: false,
          clientAllowedFormats: ['mp4', 'mov', 'webm'],
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
            aria-label={currentUrl ? 'Replace 360 video' : 'Upload 360 video'}
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            {currentUrl ? 'Replace 360° video' : 'Upload 360° video (up to 500 MB)'}
          </button>
        )}
      </CldUploadWidget>
      {error && (
        <p role="alert" className="text-xs text-red-400">{error}</p>
      )}
      <p className="text-xs text-gray-500">
        Equirectangular MP4 / MOV / WebM. Files over 20 MB upload in chunks.
      </p>
    </div>
  );
}
