'use client';

// components/academy/PodcastLinks.tsx
// Renders platform-specific "Listen on" buttons for multiple podcast URLs.

import { Headphones } from 'lucide-react';

interface PodcastLink {
  url: string;
  label?: string;
}

interface PodcastLinksProps {
  podcastLinks: PodcastLink[];
}

function detectPlatform(url: string): { name: string; color: string } {
  if (url.includes('open.spotify.com')) return { name: 'Spotify', color: 'bg-[#1DB954]' };
  if (url.includes('podcasts.apple.com') || url.includes('itunes.apple.com')) return { name: 'Apple Podcasts', color: 'bg-[#872EC4]' };
  if (url.includes('youtube.com') || url.includes('youtu.be')) return { name: 'YouTube', color: 'bg-[#FF0000]' };
  if (url.includes('music.amazon')) return { name: 'Amazon Music', color: 'bg-[#25D1DA]' };
  return { name: 'Podcast', color: 'bg-gray-700' };
}

export default function PodcastLinks({ podcastLinks }: PodcastLinksProps) {
  const validLinks = podcastLinks.filter((l) => l.url?.trim());
  if (validLinks.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-gray-900 border border-gray-800 rounded-xl">
      <Headphones className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="text-sm text-gray-400">Also available as a podcast:</span>
      {validLinks.map((link, i) => {
        const platform = detectPlatform(link.url);
        const displayLabel = link.label?.trim() || platform.name;
        return (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${platform.color} text-white rounded-lg text-xs font-semibold hover:opacity-90 transition`}
          >
            Listen on {displayLabel}
          </a>
        );
      })}
    </div>
  );
}
