/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, CheckCircle } from 'lucide-react';

type PainIntensity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Constants can be defined outside the component to prevent re-declaration on each render.
const BODY_LOCATIONS = [
  'Right Hip Flexor',
  'Left Hip Flexor',
  'Right Glute',
  'Left Glute',
  'SI Joint',
  'Lower Back (L5/S1)',
  'Mid Back (Thoracic)',
  'Neck',
  'Left Shoulder',
  'Right Shoulder',
  'Left Hamstring',
  'Right Knee',
];

// Same for this constant.
const SENSATIONS = ['Tightness', 'Pinching', 'Dull Ache', 'Sharp Stab', 'Burning'];

/**
 * A type for the data structure used to store pain log information.
 * This can be shared between the form and any data-saving functions.
 */
type PainLogPayload = {
  intensity: PainIntensity;
  locations: string[];
  sensations: string[];
  activities: string;
  notes: string;
};

export default function PainTrackingPage() {
  const [painData, setPainData] = useState<{
    intensity: PainIntensity;
    locations: string[];
    sensations: string[];
    activities: string;
    notes: string;
  }>({
    intensity: 1,
    locations: [],
    sensations: [],
    activities: '',
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  const loadTodayLog = useCallback(async () => {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('date', today)
      .single();

    if (data && data.pain_intensity) {
      setPainData({
        intensity: data.pain_intensity,
        locations: data.pain_locations || [],
        sensations: data.pain_sensations || [],
        activities: (data.pain_activities || []).join('\n'),
        notes: data.pain_notes || '',
      });
    }
    setLoading(false);
  }, [supabase, today]);

  useEffect(() => {
    loadTodayLog();
  }, [loadTodayLog]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertPainLog(supabase, painData, today);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      // The service function can throw a formatted error.
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('[Pain Log] Save failed:', errorMessage);
      alert(`Failed to save: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // This logic is now extracted into a dedicated service function below.
  // This makes the `handleSave` function above much cleaner and focused on UI state.
  const upsertPainLog = async (
    supabaseClient: ReturnType<typeof createClient>,
    logData: PainLogPayload,
    date: string
  ) => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated. Please log in.');

    const activitiesArray = logData.activities.split('\n').map(a => a.trim()).filter(a => a);

    const payload = {
      user_id: user.id,
      date: date,
      pain_intensity: logData.intensity,
      pain_locations: logData.locations.length > 0 ? logData.locations : null,
      pain_sensations: logData.sensations.length > 0 ? logData.sensations : null,
      pain_activities: activitiesArray.length > 0 ? activitiesArray : null,
      pain_notes: logData.notes || null,
    };

    const { error } = await supabaseClient.from('daily_logs').upsert(payload, { onConflict: 'user_id,date' });

    if (error) {
      console.error('[Pain Log] Database error:', error);
      throw new Error(error.message);
    }
  };

  const toggleLocation = (location: string) => {
    setPainData(prev => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter(l => l !== location)
        : [...prev.locations, location],
    }));
  };

  const toggleSensation = (sensation: string) => {
    setPainData(prev => ({
      ...prev,
      sensations: prev.sensations.includes(sensation)
        ? prev.sensations.filter(s => s !== sensation)
        : [...prev.sensations, sensation],
    }));
  };

  const isHighPain = painData.intensity >= 4;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Body Check & Pain Log</h1>
        <p className="text-gray-600">End-of-day assessment for {new Date(today).toLocaleDateString()}</p>
      </header>

      <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
        {/* Intensity Rating */}
        <div>
          <div className="flex items-center mb-3">
            <h2 className="text-xl font-bold text-gray-900">Overall Physical Discomfort (1-10)</h2>
            <span className="ml-3 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-red-100 text-red-600">
              Critical KPI
            </span>
          </div>
          <div className="flex gap-2">
            {[...Array(10)].map((_, i) => {
              const intensity = (i + 1) as PainIntensity;
              const isSelected = painData.intensity === intensity;
              
              let colorClass = 'bg-lime-200 hover:bg-lime-300 text-lime-800';
              if (intensity >= 4 && intensity <= 7) colorClass = 'bg-amber-200 hover:bg-amber-300 text-amber-800';
              if (intensity >= 8) colorClass = 'bg-red-200 hover:bg-red-300 text-red-800';

              if (isSelected) {
                colorClass = colorClass
                  .replace('-200', '-500')
                  .replace('hover:bg', 'bg')
                  .replace('-300', '-600')
                  .replace('text', 'text-white font-bold');
              }
              
              return (
                <button
                  key={intensity}
                  onClick={() => setPainData({ ...painData, intensity })}
                  className={`flex-1 py-3 rounded-lg transition text-sm ${colorClass} ${
                    isSelected ? 'scale-110 shadow-md' : ''
                  }`}
                >
                  {intensity}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            1 = No discomfort; 10 = Acute, debilitating pain
          </p>
        </div>

        {/* Conditional Fields (show if pain > 1) */}
        {painData.intensity > 1 && (
          <div className="space-y-8 p-6 border-2 border-fuchsia-100 rounded-xl bg-fuchsia-50/30">
            {/* Locations */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Affected Locations</h2>
              <div className="flex flex-wrap gap-2">
                {BODY_LOCATIONS.map(location => {
                  const isSelected = painData.locations.includes(location);
                  return (
                    <button
                      key={location}
                      onClick={() => toggleLocation(location)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition ${
                        isSelected
                          ? 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-lg'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-fuchsia-400'
                      }`}
                    >
                      {location}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sensations */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Sensation Type</h2>
              <div className="flex flex-wrap gap-2">
                {SENSATIONS.map(sensation => {
                  const isSelected = painData.sensations.includes(sensation);
                  return (
                    <button
                      key={sensation}
                      onClick={() => toggleSensation(sensation)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-sky-400'
                      }`}
                    >
                      {sensation}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activities */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Aggravating Activities</h2>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                List activities (one per line):
              </label>
              <textarea
                value={painData.activities}
                onChange={(e) => setPainData({ ...painData, activities: e.target.value })}
                rows={4}
                placeholder="Morning workout (TRX Pulls)&#10;Sitting with tablet (90 min)&#10;Long drive"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500 form-input"
              />
            </div>
          </div>
        )}

        {/* Strategic Notes */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Strategic Notes</h2>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Context for analysis:
          </label>
          <textarea
            value={painData.notes}
            onChange={(e) => setPainData({ ...painData, notes: e.target.value })}
            rows={3}
            placeholder={
              isHighPain
                ? "Pain started after 90 mins sitting. Confirms need to eliminate 'tablet in bed' habit."
                : 'Optional notes on physical state or recovery quality.'
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500 form-input"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full flex items-center justify-center px-6 py-4 rounded-lg text-lg font-semibold transition ${
            saved
              ? 'bg-lime-600 text-white'
              : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
          } disabled:opacity-50`}
        >
          {saved ? (
            <>
              <CheckCircle className="w-6 h-6 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-6 h-6 mr-2" />
              {saving ? 'Saving...' : 'Log Body Check'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}