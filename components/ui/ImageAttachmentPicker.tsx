'use client';

import { useRef, useState, useCallback } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';

interface ImageAttachmentPickerProps {
  onUploaded: (url: string, publicId: string) => void;
  maxImages?: number;
  currentCount?: number;
  variant?: 'light' | 'dark';
}

export default function ImageAttachmentPicker({
  onUploaded,
  maxImages = 10,
  currentCount = 0,
  variant = 'light',
}: ImageAttachmentPickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const dark = variant === 'dark';
  const remaining = maxImages - currentCount;

  const uploadFile = useCallback(
    async (file: File) => {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) return;

      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: fd },
      );

      if (res.ok) {
        const data = await res.json();
        onUploaded(data.secure_url, data.public_id);
      }
    },
    [onUploaded],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const batch = Array.from(files).slice(0, remaining);
      setUploading((n) => n + batch.length);

      await Promise.allSettled(
        batch.map(async (file) => {
          try {
            await uploadFile(file);
          } finally {
            setUploading((n) => n - 1);
          }
        }),
      );
    },
    [remaining, uploadFile],
  );

  if (remaining <= 0) return null;

  const btnClass = `flex items-center gap-2 px-4 py-3 min-h-11 rounded-lg text-sm font-medium transition ${
    dark
      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  }`;

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <label className={`${btnClass} cursor-pointer`}>
        <Camera className="w-4 h-4" aria-hidden="true" />
        Take Photo
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            if (cameraRef.current) cameraRef.current.value = '';
          }}
        />
      </label>

      <label className={`${btnClass} cursor-pointer`}>
        <ImagePlus className="w-4 h-4" aria-hidden="true" />
        Choose Photos
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            if (galleryRef.current) galleryRef.current.value = '';
          }}
        />
      </label>

      {uploading > 0 && (
        <div className={`flex items-center gap-2 text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Uploading {uploading}…
        </div>
      )}
    </div>
  );
}
