'use client';

import { CldUploadWidget } from 'next-cloudinary';
import { Upload } from 'lucide-react';

interface RecipeCloudinaryUploaderProps {
  mediaType: 'image' | 'video';
  onUploadSuccess: (result: { url: string; publicId: string }) => void;
  onUploadError?: (error: unknown) => void;
}

/**
 * Wraps next-cloudinary's CldUploadWidget with signed uploads for recipe media.
 * Signs uploads via /api/recipes/upload to keep the API secret server-side.
 */
export default function RecipeCloudinaryUploader({
  mediaType,
  onUploadSuccess,
  onUploadError,
}: RecipeCloudinaryUploaderProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        {mediaType === 'image'
          ? 'Images: up to 10 MB (JPG, PNG, GIF, WebP)'
          : 'Videos: up to 100 MB (MP4, MOV, WebM)'}
        {' '}· Cloudinary free tier limits
      </p>

      <CldUploadWidget
        signatureEndpoint="/api/recipes/upload"
        options={{
          resourceType: mediaType,
          folder: 'recipes',
          maxFileSize: mediaType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024,
          sources: ['local', 'url', 'camera'],
          multiple: false,
          clientAllowedFormats:
            mediaType === 'image'
              ? ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']
              : ['mp4', 'mov', 'webm', 'avi'],
        }}
        onSuccess={(result) => {
          if (result?.info && typeof result.info === 'object' && 'secure_url' in result.info) {
            onUploadSuccess({
              url: result.info.secure_url as string,
              publicId: result.info.public_id as string,
            });
          }
        }}
        onError={onUploadError}
      >
        {({ open }) => (
          <button
            type="button"
            onClick={() => open()}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 transition w-full justify-center"
          >
            <Upload className="w-4 h-4" />
            {mediaType === 'image' ? 'Upload image' : 'Upload video'}
          </button>
        )}
      </CldUploadWidget>
    </div>
  );
}
