// components/blog/PostMeta.tsx
// Displays author, date, reading time, and tags. Works in server and client components.

import { Clock, Calendar, Tag } from 'lucide-react';

interface PostMetaProps {
  publishedAt: string | null;
  readingTimeMinutes: number | null;
  tags: string[];
  authorDisplayName?: string | null;
  authorUsername?: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PostMeta({
  publishedAt,
  readingTimeMinutes,
  tags,
  authorDisplayName,
  authorUsername,
}: PostMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
      {(authorDisplayName || authorUsername) && (
        <span className="font-medium text-gray-700">
          {authorDisplayName || authorUsername}
        </span>
      )}

      {publishedAt && (
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(publishedAt)}
        </span>
      )}

      {readingTimeMinutes && (
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {readingTimeMinutes} min read
        </span>
      )}

      {tags.length > 0 && (
        <span className="flex items-center gap-1.5 flex-wrap">
          <Tag className="w-3.5 h-3.5 shrink-0" />
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
