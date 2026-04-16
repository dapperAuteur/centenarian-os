// lib/academy/media-types.ts
// Types shared between the media library API, the library UI, and the
// auto-registration path in Cloudinary360Uploader.

export type CloudinaryResourceType = 'image' | 'video' | 'raw';

export type AssetKind =
  | 'video'
  | 'image'
  | 'audio'
  | 'panorama_video'
  | 'panorama_image'
  | 'document'
  | 'other';

export interface MediaAsset {
  id: string;
  owner_id: string;
  cloudinary_public_id: string;
  cloudinary_resource_type: CloudinaryResourceType;
  secure_url: string;
  asset_kind: AssetKind;
  name: string;
  description: string | null;
  tags: string[];
  file_size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAssetReference {
  lesson_id: string;
  lesson_title: string;
  course_id: string;
  course_title: string;
  field: 'content_url' | 'video_360_poster_url';
}
