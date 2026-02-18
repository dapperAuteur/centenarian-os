'use client';

/**
 * Client-only embed sanitizer using DOMPurify.
 *
 * IMPORTANT: This file must only be imported from client components ('use client').
 * DOMPurify requires the browser's DOM — it will throw if used server-side.
 *
 * Allowed iframe sources and script sources are limited to known social platforms.
 */

import DOMPurify from 'dompurify';

const ALLOWED_IFRAME_ORIGINS = [
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://www.instagram.com',
  'https://platform.twitter.com',
  'https://twitframe.com',
  'https://www.tiktok.com',
] as const;

const ALLOWED_SCRIPT_ORIGINS = [
  'https://platform.twitter.com',
  'https://www.instagram.com',
] as const;

export function sanitizeEmbed(rawHtml: string): string {
  if (typeof window === 'undefined') return '';

  const clean = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['blockquote', 'a', 'p', 'br', 'iframe', 'script', 'div', 'span'],
    ALLOWED_ATTR: [
      'href', 'src', 'width', 'height',
      'frameborder', 'allowfullscreen', 'scrolling', 'allow',
      'class', 'id', 'style',
      'data-instgrm-version', 'data-tweet-id',
      'async', 'charset',
    ],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });

  // Post-sanitize: validate iframe and script src against allowlist
  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, 'text/html');

  doc.querySelectorAll('iframe').forEach((el) => {
    const src = el.getAttribute('src') || '';
    const allowed = ALLOWED_IFRAME_ORIGINS.some((origin) => src.startsWith(origin));
    if (!allowed) el.remove();
  });

  doc.querySelectorAll('script').forEach((el) => {
    const src = el.getAttribute('src') || '';
    const allowed = ALLOWED_SCRIPT_ORIGINS.some((origin) => src.startsWith(origin));
    if (!allowed) el.remove();
  });

  return doc.body.innerHTML;
}
