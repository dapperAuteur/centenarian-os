'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { RecipeMedia } from '@/lib/types';

interface RecipeMediaGalleryProps {
  media: RecipeMedia[];
}

export default function RecipeMediaGallery({ media }: RecipeMediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!media.length) return null;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prev = () => setLightboxIndex((i) => (i != null ? (i - 1 + media.length) % media.length : null));
  const next = () => setLightboxIndex((i) => (i != null ? (i + 1) % media.length : null));

  const current = lightboxIndex != null ? media[lightboxIndex] : null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {media.map((item, index) => (
          <button
            key={item.id}
            onClick={() => openLightbox(index)}
            className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 group"
          >
            {item.resource_type === 'image' ? (
              <Image
                src={item.url}
                alt={item.caption || `Recipe photo ${index + 1}`}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <Play className="w-8 h-8 text-white" />
                <video
                  src={item.url}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                  muted
                  preload="metadata"
                />
              </div>
            )}
            {item.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-white text-xs truncate">{item.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {current && lightboxIndex != null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition"
          >
            <X className="w-8 h-8" />
          </button>

          {media.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 text-white hover:text-gray-300 transition"
              >
                <ChevronLeft className="w-10 h-10" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 text-white hover:text-gray-300 transition"
              >
                <ChevronRight className="w-10 h-10" />
              </button>
            </>
          )}

          <div
            className="max-w-4xl w-full mx-8"
            onClick={(e) => e.stopPropagation()}
          >
            {current.resource_type === 'image' ? (
              <Image
                src={current.url}
                alt={current.caption || 'Recipe photo'}
                width={1200}
                height={800}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={current.url}
                controls
                className="w-full max-h-[80vh] rounded-lg"
                autoPlay
              />
            )}
            {current.caption && (
              <p className="text-gray-300 text-sm text-center mt-3">{current.caption}</p>
            )}
            {media.length > 1 && (
              <p className="text-gray-500 text-xs text-center mt-1">
                {lightboxIndex + 1} / {media.length}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
