'use client';

// components/academy/media-library/MediaGrid.tsx
// Responsive grid of media asset thumbnails. Clicking a tile selects the
// asset; the parent renders a detail panel for the selected id.
//
// Thumbnails:
//   - image / panorama_image → the image itself
//   - video / panorama_video → the Cloudinary so_0 poster transform
//   - audio / document / other → an icon tile

import { Play, FileText, Music, Globe, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import type { MediaAsset, AssetKind } from '@/lib/academy/media-types';

interface MediaGridProps {
  assets: MediaAsset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const KIND_ICON: Record<AssetKind, React.ElementType> = {
  video: Play,
  image: ImageIcon,
  audio: Music,
  panorama_video: Globe,
  panorama_image: Globe,
  document: FileText,
  other: FileIcon,
};

const KIND_LABEL: Record<AssetKind, string> = {
  video: 'Video',
  image: 'Image',
  audio: 'Audio',
  panorama_video: '360° Video',
  panorama_image: '360° Photo',
  document: 'Document',
  other: 'File',
};

/** Derive a thumbnail URL from a Cloudinary asset. */
function thumbnailFor(asset: MediaAsset): string | null {
  if (asset.cloudinary_resource_type === 'image') return asset.secure_url;
  if (asset.cloudinary_resource_type === 'video') {
    // so_0 = first frame, f_jpg = force JPG for smaller thumbnails
    const uploadIdx = asset.secure_url.indexOf('/upload/');
    if (uploadIdx === -1) return null;
    const prefix = asset.secure_url.slice(0, uploadIdx + '/upload/'.length);
    const rest = asset.secure_url.slice(uploadIdx + '/upload/'.length);
    return (prefix + 'so_0,w_480,h_270,c_fill/' + rest).replace(/\.(mp4|mov|webm|mkv|insv|m4v)(\?.*)?$/i, '.jpg$2');
  }
  return null;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaGrid({ assets, selectedId, onSelect }: MediaGridProps) {
  return (
    <ul
      role="list"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
    >
      {assets.map((asset) => {
        const Icon = KIND_ICON[asset.asset_kind] ?? FileIcon;
        const thumb = thumbnailFor(asset);
        const isSelected = asset.id === selectedId;
        return (
          <li key={asset.id}>
            <button
              type="button"
              onClick={() => onSelect(asset.id)}
              aria-pressed={isSelected}
              className={`w-full text-left flex flex-col bg-gray-900 border rounded-xl overflow-hidden transition focus:outline-none focus:ring-2 focus:ring-fuchsia-500 ${
                isSelected
                  ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/40'
                  : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                {thumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumb}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Icon className="w-8 h-8 text-gray-600" aria-hidden="true" />
                )}
                <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] uppercase tracking-wide text-gray-200 backdrop-blur-sm">
                  {KIND_LABEL[asset.asset_kind] ?? 'File'}
                </span>
              </div>
              <div className="p-3 space-y-1 min-w-0">
                <p className="text-sm text-white truncate" title={asset.name}>{asset.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {formatSize(asset.file_size_bytes) || new Date(asset.created_at).toLocaleDateString()}
                </p>
                {asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {asset.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-900/40 text-fuchsia-300">
                        {tag}
                      </span>
                    ))}
                    {asset.tags.length > 3 && (
                      <span className="text-[10px] text-gray-500">+{asset.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
