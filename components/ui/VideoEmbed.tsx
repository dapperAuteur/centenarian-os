'use client';

import { getEmbedUrl } from '@/lib/video/getEmbedUrl';
import { ExternalLink } from 'lucide-react';

interface VideoEmbedProps {
  url: string;
  title?: string;
  className?: string;
}

export default function VideoEmbed({ url, title, className }: VideoEmbedProps) {
  const { provider, embedUrl } = getEmbedUrl(url);

  if (provider !== 'unknown' && embedUrl) {
    return (
      <div className={`aspect-video rounded-lg overflow-hidden bg-black ${className ?? ''}`}>
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title={title || 'Video'}
        />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors ${className ?? ''}`}
    >
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      Watch video
    </a>
  );
}
