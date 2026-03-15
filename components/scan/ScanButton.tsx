'use client';

import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import type { DocumentType } from '@/lib/ocr/classify';

export interface ScanResult {
  documentType: DocumentType;
  confidence: number;
  extracted: Record<string, unknown>;
  suggestedModules: string[];
  imageUrl?: string;
  scanImageId?: string;
}

interface ScanButtonProps {
  onResult: (data: ScanResult) => void;
  onError?: (error: string) => void;
  moduleHint?: DocumentType;
  label?: string;
  className?: string;
}

export default function ScanButton({
  onResult,
  onError,
  moduleHint,
  label = 'Scan',
  className,
}: ScanButtonProps) {
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    if (!files.length) return;
    setLoading(true);
    try {
      const fd = new FormData();
      for (let i = 0; i < Math.min(files.length, 4); i++) {
        fd.append('images', files[i]);
      }
      if (moduleHint) fd.append('hint', moduleHint);

      const res = await offlineFetch('/api/ocr/scan', {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Scan failed' }));
        onError?.(err.error || 'Scan failed');
        return;
      }

      const data: ScanResult = await res.json();
      onResult(data);
    } catch {
      onError?.('Scan failed — please try again');
    } finally {
      setLoading(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const btnClass = className ||
    'flex items-center gap-1.5 px-3 py-2 min-h-11 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition cursor-pointer';

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <label className={btnClass}>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Camera className="w-4 h-4" aria-hidden="true" />
        )}
        {loading ? 'Scanning...' : label}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </label>
      <label className={btnClass}>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <ImagePlus className="w-4 h-4" aria-hidden="true" />
        )}
        Choose Photos
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </label>
    </div>
  );
}
