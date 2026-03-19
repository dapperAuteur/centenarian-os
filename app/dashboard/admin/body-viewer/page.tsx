'use client';

// app/dashboard/admin/body-viewer/page.tsx
// Admin-only page for exploring the BioDigital 3D anatomy viewer.
// Search exercises, select one, and see its muscles highlighted on the 3D body.
// Gate: ADMIN_EMAIL only (checked client-side via /api/auth/me).

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, AlertTriangle } from 'lucide-react';
import BioDigitalViewer from '@/components/ui/BioDigitalViewer';
import MuscleDiagram from '@/components/ui/MuscleDiagram';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Exercise {
  id: string;
  name: string;
  primary_muscles: string[] | null;
  category: string;
  difficulty: string;
}

export default function AdminBodyViewerPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualMuscles, setManualMuscles] = useState('');

  // Check admin status
  useEffect(() => {
    offlineFetch('/api/auth/me').then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        setIsAdmin(d.isAdmin ?? false);
      } else {
        setIsAdmin(false);
      }
    }).catch(() => setIsAdmin(false));
  }, []);

  const loadExercises = useCallback(async () => {
    setLoading(true);
    const res = await offlineFetch('/api/exercises/system');
    if (res.ok) {
      const d = await res.json();
      setExercises(d.exercises || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadExercises();
  }, [isAdmin, loadExercises]);

  const filtered = exercises.filter((e) =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()),
  );

  const activeMuscles = selected?.primary_muscles
    ?? manualMuscles.split(',').map((m) => m.trim()).filter(Boolean);

  if (isAdmin === null) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-lg font-semibold text-gray-900">Admin access required</p>
        <p className="text-sm text-gray-500 mt-1">This page is only available to admins.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Body Viewer</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search an exercise to highlight its muscles on the 3D anatomy viewer, or enter muscle names manually.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exercise selector */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
              {filtered.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => { setSelected(ex); setManualMuscles(''); }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 transition hover:bg-gray-50 ${
                    selected?.id === ex.id ? 'bg-sky-50 border-l-4 border-l-sky-500' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{ex.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ex.category}</p>
                  {ex.primary_muscles && ex.primary_muscles.length > 0 && (
                    <p className="text-xs text-fuchsia-600 mt-0.5">{ex.primary_muscles.join(', ')}</p>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No exercises found.</p>
              )}
            </div>
          )}

          {/* Manual muscle input */}
          <div>
            <label htmlFor="manual-muscles" className="block text-xs font-medium text-gray-600 mb-1">
              Or enter muscles manually (comma-separated)
            </label>
            <input
              id="manual-muscles"
              value={manualMuscles}
              onChange={(e) => { setManualMuscles(e.target.value); setSelected(null); }}
              placeholder="chest, triceps, anterior deltoid"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Viewers */}
        <div className="lg:col-span-2 space-y-4">
          {selected && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-sky-900">{selected.name}</p>
              {selected.primary_muscles && (
                <p className="text-xs text-sky-700 mt-0.5">{selected.primary_muscles.join(', ')}</p>
              )}
            </div>
          )}

          {/* SVG Diagram */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">SVG Muscle Map</h2>
            <MuscleDiagram primaryMuscles={activeMuscles} size="lg" />
          </div>

          {/* BioDigital 3D Viewer */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              BioDigital 3D Viewer
              <span className="ml-2 text-[10px] font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                Requires NEXT_PUBLIC_BIODIGITAL_API_KEY
              </span>
            </h2>
            <BioDigitalViewer muscles={activeMuscles} height="460px" />
          </div>
        </div>
      </div>
    </div>
  );
}
