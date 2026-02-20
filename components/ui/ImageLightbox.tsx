'use client';

// components/ui/ImageLightbox.tsx
// Thumbnail with click-to-enlarge lightbox modal + download/open-in-tab buttons.
// Works for images; videos render inline with native controls (no lightbox needed).

import { useState, useEffect, useCallback } from 'react';
import { X, Download, ExternalLink, ZoomIn } from 'lucide-react';

interface Props {
  url: string;
  /** Extra classes applied to the thumbnail wrapper */
  thumbnailClass?: string;
}

export default function ImageLightbox({ url, thumbnailClass = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isVideo = /\.(mp4|webm|mov|avi)/i.test(url) || url.includes('/video/');

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    setDownloading(true);
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = url.split('/').pop()?.split('?')[0] ?? 'attachment';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  }

  if (isVideo) {
    return (
      <video
        src={url}
        className={`rounded-lg border border-gray-200 mt-2 max-h-40 ${thumbnailClass}`}
        controls
      />
    );
  }

  return (
    <>
      {/* Clickable thumbnail */}
      <div
        className={`relative inline-block mt-2 group cursor-zoom-in ${thumbnailClass}`}
        onClick={() => setOpen(true)}
        role="button"
        aria-label="Click to enlarge"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="attachment"
          className="max-h-40 rounded-lg border border-gray-200 object-contain block"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover:bg-black/40 transition-all duration-150 pointer-events-none">
          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all duration-150 drop-shadow-lg" />
        </div>
      </div>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] bg-black/92 flex items-center justify-center p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          <div
            className="relative flex flex-col items-center gap-3 max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toolbar */}
            <div className="flex items-center gap-2 self-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }}
                title="Open in new tab"
                className="p-2 bg-white/15 hover:bg-white/25 rounded-lg text-white transition"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                title="Download"
                className="p-2 bg-white/15 hover:bg-white/25 rounded-lg text-white transition disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={close}
                title="Close (Esc)"
                className="p-2 bg-white/15 hover:bg-white/25 rounded-lg text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Full-size image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="attachment"
              className="max-h-[82vh] max-w-full rounded-lg object-contain shadow-2xl"
            />

            <p className="text-white/40 text-xs">Click outside or press Esc to close</p>
          </div>
        </div>
      )}
    </>
  );
}
