'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, Save, Trash2, X } from 'lucide-react';
import { Tldraw, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';

interface DoodleCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (url: string, publicId: string) => void;
  sessionId: string;
}

const STORAGE_KEY_PREFIX = 'doodle_snapshot_';

export default function DoodleCanvas({ isOpen, onClose, onSaved, sessionId }: DoodleCanvasProps) {
  const editorRef = useRef<Editor | null>(null);
  const [saving, setSaving] = useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${sessionId}`;

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Restore previous snapshot if it exists
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const snapshot = JSON.parse(saved);
        editor.loadSnapshot(snapshot);
      } catch {
        // Ignore corrupted snapshots
      }
    }
  }, [storageKey]);

  const saveSnapshot = useCallback(() => {
    if (!editorRef.current) return;
    const snapshot = editorRef.current.getSnapshot();
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [storageKey]);

  const handleSave = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) return;

    setSaving(true);
    try {
      // Save snapshot for re-editing
      saveSnapshot();

      // Export all shapes as PNG
      const shapeIds = [...editor.getCurrentPageShapeIds()];
      if (shapeIds.length === 0) {
        setSaving(false);
        return;
      }

      const { blob } = await editor.toImage(shapeIds, {
        format: 'png',
        scale: 2,
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
    const editor = editorRef.current;
    if (!editor) return;
    const shapeIds = [...editor.getCurrentPageShapeIds()];
    if (shapeIds.length > 0) {
      editor.deleteShapes(shapeIds);
    }
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Doodle / Sketch</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition min-h-11"
            aria-label="Clear canvas"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Clear
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-11"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="w-4 h-4" aria-hidden="true" />
            )}
            {saving ? 'Saving…' : 'Save Drawing'}
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
      <div className="flex-1 relative">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}
