'use client';

import { Star, Edit3, Trash2 } from 'lucide-react';

export interface MediaItem {
  id: string;
  title: string;
  creator: string | null;
  media_type: string;
  status: string;
  rating: number | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  external_url?: string | null;
  genre: string[];
  tags: string[];
  current_progress: string | null;
  total_length: string | null;
  season_number: number | null;
  episode_number: number | null;
  total_seasons?: number | null;
  total_episodes?: number | null;
  brand_id?: string | null;
  is_favorite: boolean;
  source_platform: string | null;
  year_released: number | null;
  visibility: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  book: '\u{1F4D6}', tv_show: '\u{1F4FA}', movie: '\u{1F3AC}',
  video: '\u{1F4F9}', song: '\u{1F3B5}', album: '\u{1F4BF}',
  podcast: '\u{1F399}', art: '\u{1F3A8}', article: '\u{1F4F0}', other: '\u{1F4E6}',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  want_to_consume: { label: 'Want', className: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'In Progress', className: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Done', className: 'bg-green-50 text-green-700' },
  dropped: { label: 'Dropped', className: 'bg-gray-100 text-gray-500' },
};

interface MediaCardProps {
  item: MediaItem;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function MediaCard({ item, onClick, onEdit, onDelete }: MediaCardProps) {
  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.want_to_consume;
  const icon = TYPE_ICONS[item.media_type] ?? '\u{1F4E6}';

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl p-3 hover:border-fuchsia-300 hover:shadow-sm transition group">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left cursor-pointer"
        aria-label={`View ${item.title}`}
      >
        <div className="flex gap-3">
          {item.cover_image_url ? (
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.cover_image_url}
              alt=""
              className="w-14 h-20 object-cover rounded-lg shrink-0 bg-gray-100"
            />
          ) : (
            <div className="w-14 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{item.title}</h3>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            {item.creator && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{item.creator}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-gray-400 capitalize">{item.media_type.replace('_', ' ')}</span>
              {item.rating != null && (
                <span className="flex items-center gap-0.5 text-xs text-amber-600">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {item.rating}
                </span>
              )}
              {item.year_released && (
                <span className="text-xs text-gray-400">{item.year_released}</span>
              )}
              {item.source_platform && (
                <span className="text-xs text-gray-400">{item.source_platform}</span>
              )}
            </div>
            {item.current_progress && (
              <p className="text-[10px] text-gray-400 mt-1">{item.current_progress}{item.total_length ? ` / ${item.total_length}` : ''}</p>
            )}
          </div>
        </div>
      </button>
      {(onEdit || onDelete) && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex items-center justify-center min-h-8 min-w-8 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-sky-600 hover:border-sky-300 transition shadow-sm"
              aria-label={`Edit ${item.title}`}
            >
              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="flex items-center justify-center min-h-8 min-w-8 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-red-600 hover:border-red-300 transition shadow-sm"
              aria-label={`Delete ${item.title}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
