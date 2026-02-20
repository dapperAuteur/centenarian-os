'use client';

// components/ui/MediaUploader.tsx
// Uploads images/videos to Cloudinary using an unsigned upload preset.
// Requires: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME + NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
// The upload preset must be set to "Unsigned" in the Cloudinary dashboard.

import { useRef, useState } from 'react';
import { Paperclip, X, Loader2, Image as ImageIcon, Film } from 'lucide-react';

interface Props {
  onUpload: (url: string) => void;
  onRemove?: () => void;
  currentUrl?: string | null;
  accept?: string;
  label?: string;
  dark?: boolean;
}

export default function MediaUploader({
  onUpload,
  onRemove,
  currentUrl,
  accept = 'image/*,video/*',
  label = 'Attach media',
  dark = false,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!cloudName || !uploadPreset) {
      setError('Cloudinary is not configured (missing env vars).');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        { method: 'POST', body: form }
      );
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      if (!data.secure_url) throw new Error('No URL returned');
      onUpload(data.secure_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const isVideo = currentUrl ? /\.(mp4|webm|mov|avi)/.test(currentUrl) || currentUrl.includes('/video/') : false;

  const btnBase = dark
    ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition disabled:opacity-50'
    : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-50';

  return (
    <div className="flex flex-col gap-2">
      {/* Current attachment preview */}
      {currentUrl && (
        <div className="relative inline-block">
          {isVideo ? (
            <video src={currentUrl} className="max-h-32 rounded-lg border border-gray-200" controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="attachment" className="max-h-32 rounded-lg border border-gray-200 object-cover" />
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove"
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Upload button */}
      {!currentUrl && (
        <>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className={btnBase}
          >
            {uploading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Paperclip className="w-3.5 h-3.5" />
            }
            {uploading ? 'Uploading…' : label}
            <span className="text-gray-500 font-normal">
              <ImageIcon className="w-3 h-3 inline" />/<Film className="w-3 h-3 inline" />
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFile}
            className="hidden"
          />
        </>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
