'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DailyLog } from '@/lib/types';
import EntryComposer from '@/components/ui/EntryComposer';

export default function DailyDebriefPage() {
  const [log, setLog] = useState<Partial<DailyLog>>({
    energy_rating: null,
    biggest_win: '',
    biggest_challenge: '',
  });
  const [logId, setLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  const loadTodayLog = useCallback(async () => {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (data) {
      setLogId(data.id);
      setLog({
        energy_rating: data.energy_rating,
        biggest_win: data.biggest_win || '',
        biggest_challenge: data.biggest_challenge || '',
      });
    }
    setLoading(false);
  }, [supabase, today]);

  useEffect(() => {
    loadTodayLog();
  }, [loadTodayLog]);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('daily_logs')
      .upsert({
        user_id: user.id,
        date: today,
        energy_rating: log.energy_rating,
        biggest_win: log.biggest_win || null,
        biggest_challenge: log.biggest_challenge || null,
      }, { onConflict: 'user_id,date' })
      .select('id')
      .maybeSingle();

    if (error) throw new Error(error.message);

    // Set logId so extras (audio, links, tags) become available
    if (data?.id) setLogId(data.id);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Daily Debrief</h1>
        <p className="text-gray-600">End-of-day reflection for {new Date(today).toLocaleDateString()}</p>
      </header>

      <div className="bg-white rounded-2xl shadow-xl p-8">
        <EntryComposer
          entityType="daily_log"
          entityId={logId}
          features={{ audio: true, photos: true, activityLinks: true, lifeCategories: true }}
          onSave={handleSave}
          saveLabel="Save Debrief"
          saveDisabled={!log.energy_rating}
        >
          <div className="space-y-8">
            {/* Energy Rating */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-4">
                How was your energy/focus today? (1-5)
              </label>
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setLog({ ...log, energy_rating: rating })}
                    className={`flex-1 py-4 rounded-xl text-lg font-bold transition ${
                      log.energy_rating === rating
                        ? 'bg-indigo-600 text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">1 = Exhausted, 5 = Peak performance</p>
            </div>

            {/* Biggest Win */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-2">
                What was your single biggest win today?
              </label>
              <textarea
                value={log.biggest_win || ''}
                onChange={(e) => setLog({ ...log, biggest_win: e.target.value })}
                rows={3}
                placeholder="Completed a key milestone, solved a tough problem, had a breakthrough..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent form-input"
              />
            </div>

            {/* Biggest Challenge */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-2">
                What was your biggest challenge?
              </label>
              <textarea
                value={log.biggest_challenge || ''}
                onChange={(e) => setLog({ ...log, biggest_challenge: e.target.value })}
                rows={3}
                placeholder="What blocked progress? What needs to be addressed?"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent form-input"
              />
            </div>
          </div>
        </EntryComposer>
      </div>
    </div>
  );
}
