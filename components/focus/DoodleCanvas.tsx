'use client';

import { memo, useCallback, useRef, useState, useMemo } from 'react';
import { Loader2, Save, Trash2, X } from 'lucide-react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types';

interface DoodleCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (url: string, publicId: string) => void;
  sessionId: string;
}

const STORAGE_KEY_PREFIX = 'doodle_snapshot_';

// Stable UIOptions — never recreated across renders
const EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    loadScene: false,
    saveToActiveFile: false,
    export: false,
    saveAsImage: false,
  },
};

export default memo(function DoodleCanvas({ isOpen, onClose, onSaved, sessionId }: DoodleCanvasProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [saving, setSaving] = useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${sessionId}`;

  // Stable callback for excalidrawAPI — prevents Excalidraw from re-initializing
  const handleExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
  }, []);

  // Load initial data from localStorage (if any previous drawing exists)
  const initialData = useMemo<ExcalidrawInitialDataState | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const saved = localStorage.getItem(storageKey);
    if (!saved) return undefined;
    try {
      return JSON.parse(saved) as ExcalidrawInitialDataState;
    } catch {
      return undefined;
    }
  }, [storageKey]);

  const saveSnapshot = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const snapshot = {
      elements: api.getSceneElements(),
      appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor },
    };
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [storageKey]);

  const handleSave = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) return;

    const elements = api.getSceneElements();
    if (elements.length === 0) return;

    setSaving(true);
    try {
      // Save snapshot for re-editing
      saveSnapshot();

      // Export to PNG blob
      const blob = await exportToBlob({
        elements,
        appState: { ...api.getAppState(), exportWithDarkMode: false },
        files: api.getFiles(),
        getDimensions: () => ({ width: 1920, height: 1080, scale: 2 }),
      });

      // Upload to Cloudinary
      const fd = new FormData();
      fd.append('file', blob, 'doodle.png');
      fd.append('upload_preset', uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: fd },
      );

      if (res.ok) {
        const data = await res.json();
        onSaved(data.secure_url, data.public_id);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }, [onSaved, onClose, saveSnapshot]);

  const handleClear = useCallback(() => {
    apiRef.current?.resetScene();
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col bg-white"
      style={{ height: '100dvh' }}
      role="dialog"
      aria-modal="true"
      aria-label="Doodle canvas"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Doodle</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition min-h-11"
            aria-label="Clear canvas"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-11"
            aria-label={saving ? 'Saving drawing' : 'Save drawing'}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="w-4 h-4" aria-hidden="true" />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => { saveSnapshot(); onClose(); }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Close doodle canvas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="absolute inset-0">
          <Excalidraw
            excalidrawAPI={handleExcalidrawAPI}
            initialData={initialData}
            UIOptions={EXCALIDRAW_UI_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
});
