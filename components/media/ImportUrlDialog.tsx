'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Globe, Loader2 } from 'lucide-react';

interface ImportedData {
  title: string;
  media_type: string;
  creator: string | null;
  year_released: number | null;
  cover_image_url: string | null;
  genre: string[];
  notes: string | null;
  external_url: string;
}

interface ImportUrlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (data: ImportedData) => void;
}

export default function ImportUrlDialog({ isOpen, onClose, onImported }: ImportUrlDialogProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/media/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import failed');
        return;
      }
      onImported(data);
      setUrl('');
    } catch {
      setError('Network error — try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from URL">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500">
          Paste a link from IMDB, Goodreads, or any page with structured data.
        </p>
        <div>
          <label htmlFor="import-url" className="block text-xs font-medium text-gray-600 mb-1">URL</label>
          <div className="flex gap-2">
            <input
              id="import-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              placeholder="https://www.imdb.com/title/..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent outline-none min-h-11"
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={loading || !url.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 rounded-xl transition flex items-center gap-1.5 min-h-11"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" aria-hidden="true" />}
              {loading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        )}
      </div>
    </Modal>
  );
}
