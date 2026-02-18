'use client';

import { useEffect, useRef, useState } from 'react';
import { sanitizeEmbed } from '@/lib/blog/sanitize-embed';

interface SocialEmbedBlockProps {
  html: string;
}

/**
 * Renders a social media embed (Twitter, Instagram, TikTok, etc.)
 * Sanitizes the raw embed HTML client-side using DOMPurify before rendering.
 */
export default function SocialEmbedBlock({ html }: SocialEmbedBlockProps) {
  const [clean, setClean] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sanitized = sanitizeEmbed(html);
    setClean(sanitized);
  }, [html]);

  // Re-run any platform embed scripts (e.g., Twitter widgets) after DOM update
  useEffect(() => {
    if (!clean || !containerRef.current) return;

    // Twitter/X widget script
    if (clean.includes('platform.twitter.com') && (window as { twttr?: { widgets?: { load: (el: HTMLElement) => void } } }).twttr?.widgets) {
      (window as { twttr?: { widgets?: { load: (el: HTMLElement) => void } } }).twttr!.widgets!.load(containerRef.current);
    }

    // Instagram embed script
    if (clean.includes('instagram.com') && (window as { instgrm?: { Embeds?: { process: () => void } } }).instgrm?.Embeds) {
      (window as { instgrm?: { Embeds?: { process: () => void } } }).instgrm!.Embeds!.process();
    }
  }, [clean]);

  if (!clean) return null;

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
