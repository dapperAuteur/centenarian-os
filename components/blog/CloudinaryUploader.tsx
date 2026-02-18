'use client';

import { CldUploadWidget } from 'next-cloudinary';
import { Upload } from 'lucide-react';

interface CloudinaryUploaderProps {
  mediaType: 'image' | 'video';
  onUploadSuccess: (result: { url: string; publicId: string }) => void;
  onUploadError?: (error: unknown) => void;
}

/**
 * Wraps next-cloudinary's CldUploadWidget with signed uploads.
 * Signs uploads via /api/blog/upload to keep the API secret server-side.
 */
export default function CloudinaryUploader({
  mediaType,
  onUploadSuccess,
  onUploadError,
}: CloudinaryUploaderProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        {mediaType === 'image'
          ? 'Images: up to 10 MB (JPG, PNG, GIF, WebP)'
          : 'Videos: up to 100 MB (MP4, MOV, WebM)'}
        {' '}· Cloudinary free tier limits
      </p>

      <CldUploadWidget
        signatureEndpoint="/api/blog/upload"
        options={{
          resourceType: mediaType,
          maxFileSize: mediaType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024,
          sources: ['local', 'url', 'camera'],
          multiple: false,
          clientAllowedFormats:
            mediaType === 'image'
              ? ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']
              : ['mp4', 'mov', 'webm', 'avi'],
          cropping: false,
        }}
        onSuccess={(result) => {
          if (result.event === 'success' && result.info && typeof result.info === 'object') {
            const info = result.info as { secure_url: string; public_id: string };
            onUploadSuccess({ url: info.secure_url, publicId: info.public_id });
          }
        }}
        onError={(error) => {
          console.error('[CloudinaryUploader] Upload error:', error);
          onUploadError?.(error);
        }}
      >
        {({ open }) => (
          <button
            type="button"
            onClick={() => open()}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-sky-400 hover:text-sky-600 transition w-full justify-center"
          >
            <Upload className="w-4 h-4" />
            Click to upload {mediaType === 'image' ? 'image' : 'video'}
          </button>
        )}
      </CldUploadWidget>
    </div>
  );
}
