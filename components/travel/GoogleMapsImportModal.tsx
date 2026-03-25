'use client';

import { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface ImportedLeg {
  mode: string;
  origin: string | null;
  destination: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  cost: number | null;
  purpose: string | null;
  vehicle_id: string | null;
}

interface ImportedRoute {
  name: string | null;
  isRoundTrip: boolean;
  legs: ImportedLeg[];
}

interface GoogleMapsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (route: ImportedRoute) => void;
}

export default function GoogleMapsImportModal({ isOpen, onClose, onImported }: GoogleMapsImportModalProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await offlineFetch('/api/travel/maps-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Import failed' }));
        setError(data.error || 'Could not parse the Google Maps link');
        return;
      }

      const { route } = await res.json();

      // Convert to LegData format for MultiStopForm
      const legs: ImportedLeg[] = route.legs.map((leg: {
        origin: string;
        destination: string;
        distance_miles: number | null;
        duration_min: number | null;
        mode: string;
      }) => ({
        mode: leg.mode,
        origin: leg.origin,
        destination: leg.destination,
        distance_miles: leg.distance_miles,
        duration_min: leg.duration_min,
        cost: null,
        purpose: null,
        vehicle_id: null,
      }));

      onImported({
        name: route.name,
        isRoundTrip: route.isRoundTrip,
        legs,
      });

      setUrl('');
      onClose();
    } catch {
      setError('Failed to import route');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from Google Maps" size="sm">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Paste a Google Maps directions link to import stops with distances.
        </p>

        <div>
          <label htmlFor="maps-url" className="block text-xs font-medium text-gray-600 mb-1">
            Google Maps Link
          </label>
          <input
            id="maps-url"
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleImport(); }}
            placeholder="https://maps.app.goo.gl/... or https://google.com/maps/dir/..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-11"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-sky-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Resolving link and calculating distances...
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 px-6 py-3 flex flex-col sm:flex-row gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={onClose}
          className="flex-1 border border-gray-200 rounded-xl min-h-11 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={!url.trim() || loading}
          className="flex-1 flex items-center justify-center gap-2 bg-sky-600 text-white rounded-xl min-h-11 text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50"
        >
          <MapPin className="w-4 h-4" aria-hidden="true" />
          Import Route
        </button>
      </div>
    </Modal>
  );
}
