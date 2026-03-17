'use client';

import { useState, useCallback } from 'react';
import { X, ScanSearch, Loader2 } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import type { ScanResult } from '@/components/scan/ScanButton';

interface ImageAttachment {
  id: string;
  image_url: string;
  image_public_id: string | null;
  label: string | null;
}

interface ImageAttachmentGridProps {
  attachments: ImageAttachment[];
  onRemove: (id: string) => void;
  onScanResult?: (data: ScanResult) => void;
  variant?: 'light' | 'dark';
}

export default function ImageAttachmentGrid({
  attachments,
  onRemove,
  onScanResult,
  variant = 'light',
}: ImageAttachmentGridProps) {
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const dark = variant === 'dark';

  const handleScan = useCallback(
    async (attachment: ImageAttachment) => {
      if (!onScanResult) return;
      setScanningId(attachment.id);
      try {
        // Fetch the image as a blob and send to OCR
        const imgRes = await fetch(attachment.image_url);
        const blob = await imgRes.blob();
        const file = new File([blob], 'scan.jpg', { type: blob.type });

        const fd = new FormData();
        fd.append('images', file);

        const res = await offlineFetch('/api/ocr/scan', {
          method: 'POST',
          body: fd,
        });

        if (res.ok) {
          const data: ScanResult = await res.json();
          onScanResult(data);
        }
      } finally {
        setScanningId(null);
      }
    },
    [onScanResult],
  );

  if (!attachments.length) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {attachments.map((att) => (
          <div
            key={att.id}
            className={`group relative rounded-lg overflow-hidden border ${
              dark ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <button
              type="button"
              className="w-full aspect-square"
              onClick={() => setLightboxUrl(att.image_url)}
              aria-label={att.label || 'View image'}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.image_url}
                alt={att.label || 'Attached image'}
                className="w-full h-full object-cover"
              />
            </button>

            {/* Overlay controls */}
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onScanResult && (
                <button
                  type="button"
                  onClick={() => handleScan(att)}
                  disabled={scanningId === att.id}
                  className="min-h-8 min-w-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                  aria-label="Scan image with OCR"
                >
                  {scanningId === att.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ScanSearch className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="min-h-8 min-w-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition"
                aria-label="Remove image"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {att.label && (
              <div
                className={`absolute bottom-0 inset-x-0 px-2 py-1 text-xs truncate ${
                  dark ? 'bg-black/70 text-gray-200' : 'bg-black/50 text-white'
                }`}
              >
                {att.label}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-label="Image preview"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 min-h-11 min-w-11 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Full size preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
