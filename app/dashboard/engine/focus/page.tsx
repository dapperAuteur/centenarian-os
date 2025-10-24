/* eslint-disable @typescript-eslint/no-unused-vars */
// app/dashboard/engine/focus/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FocusSession, Task } from '@/lib/types';
import { Play, Pause, StopCircle } from 'lucide-react';
import PomodoroPresets from '@/components/focus/PomodoroPresets';
import CustomPresetModal from '@/components/focus/CustomPresetModal';

export default function FocusTimerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  
  // ✅ Add Pomodoro state
  const [customPresets, setCustomPresets] = useState<Array<{
    id: string;
    name: string;
    duration: number;
    description: string;
  }>>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetDuration, setPresetDuration] = useState<number | null>(null);
  const [targetDuration, setTargetDuration] = useState<number | null>(null);
  
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const [tasksRes, sessionsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('date', today)
        .eq('completed', false)
        .order('time'),
      supabase
        .from('focus_sessions')
        .select('*')
        .gte('start_time', today + 'T00:00:00')
        .order('start_time', { ascending: false })
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (sessionsRes.data) {
      setSessions(sessionsRes.data);
      // Check for active session
      const active = sessionsRes.data.find(s => !s.end_time);
      if (active) {
        setCurrentSessionId(active.id);
        setSelectedTaskId(active.task_id || '');
        setIsRunning(true);
        const elapsed = Math.floor((Date.now() - new Date(active.start_time).getTime()) / 1000);
        setElapsedSeconds(elapsed);
      }
    }
  }, [supabase]);

  // ✅ Load custom presets on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('focus_custom_presets');
    if (savedPresets) {
      try {
        setCustomPresets(JSON.parse(savedPresets));
      } catch (err) {
        console.error('Failed to load custom presets:', err);
      }
    }
    loadData();
  }, [loadData]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // ✅ Save custom presets
  const handleSavePresets = (presets: typeof customPresets) => {
    setCustomPresets(presets);
    localStorage.setItem('focus_custom_presets', JSON.stringify(presets));
  };

  // ✅ Handle preset selection
  const handlePresetSelect = (duration: number) => {
    setPresetDuration(duration);
  };

  const startSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('focus_sessions')
      .insert([{
        user_id: user.id,
        task_id: selectedTaskId || null,
        start_time: new Date().toISOString(),
        hourly_rate: hourlyRate,
        revenue: 0,
      }])
      .select()
      .single();

    if (data) {
      setCurrentSessionId(data.id);
      setIsRunning(true);
      setElapsedSeconds(0);
      
      // ✅ Store target duration if preset was used
      if (presetDuration) {
        setTargetDuration(presetDuration * 60); // Convert to seconds
        setPresetDuration(null); // Clear preset
      }
    }
  };

  const pauseSession = () => {
    setIsRunning(false);
  };

  const resumeSession = () => {
    setIsRunning(true);
  };

  const stopSession = async () => {
    if (!currentSessionId) return;
    const revenueEarned = (elapsedSeconds / 3600) * hourlyRate;

    await supabase
      .from('focus_sessions')
      .update({
        end_time: new Date().toISOString(),
        duration: elapsedSeconds, // ✅ Use 'duration' not 'duration_seconds'
        revenue: revenueEarned,
        notes: notes || null,
      })
      .eq('id', currentSessionId);

    setIsRunning(false);
    setCurrentSessionId(null);
    setElapsedSeconds(0);
    setNotes('');
    setTargetDuration(null); // ✅ Clear target
    loadData();
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ✅ Calculate target progress
  const targetReached = targetDuration && elapsedSeconds >= targetDuration;

  const todayTotal = sessions
    .filter(s => s.duration)
    .reduce((sum, s) => sum + (s.duration || 0), 0);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Focus Timer</h1>
        <p className="text-gray-600">Track deep work linked to tasks</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timer */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="text-7xl font-bold text-gray-900 mb-4 font-mono">
                {formatTime(elapsedSeconds)}
              </div>
              {currentSessionId && (
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  isRunning ? 'bg-lime-100 text-lime-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {isRunning ? 'Running' : 'Paused'}
                </div>
              )}
            </div>

            {!currentSessionId ? (
              <div className="space-y-4">
                {/* ✅ Pomodoro Presets */}
                <PomodoroPresets
                  onSelectPreset={handlePresetSelect}
                  onOpenCustom={() => setShowPresetModal(true)}
                  disabled={false}
                />

                {/* ✅ Show selected preset */}
                {presetDuration && (
                  <div className="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-lg">
                    <p className="text-sm font-semibold text-indigo-900">
                      🎯 Target Duration: <span className="text-lg">{presetDuration} minutes</span>
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">
                      Click &quot;Start Focus Session&quot; below to begin
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link to Task (optional)
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
                  >
                    <option value="">No task selected</option>
                    {tasks.map(task => (
                      <option key={task.id} value={task.id}>
                        {task.time} - {task.activity}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hourly Rate (optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                    placeholder="$0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">Track billable time value</p>
                </div>
                <button
                  onClick={startSession}
                  className="w-full flex items-center justify-center px-6 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-lg hover:bg-indigo-700 transition"
                >
                  <Play className="w-6 h-6 mr-2" />
                  Start Focus Session
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ✅ Target Progress Indicator */}
                {targetDuration && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-blue-900">
                        🎯 Target: {Math.floor(targetDuration / 60)} minutes
                      </span>
                      <span className="text-sm text-blue-700">
                        {Math.floor(elapsedSeconds / 60)} / {Math.floor(targetDuration / 60)} min
                      </span>
                    </div>
                    <div className="relative w-full h-3 bg-blue-100 rounded-full overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 h-full transition-all ${
                          targetReached ? 'bg-lime-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min((elapsedSeconds / targetDuration) * 100, 100)}%` }}
                      />
                    </div>
                    {targetReached && (
                      <div className="mt-2 flex items-center justify-center space-x-2">
                        <span className="text-xs font-bold text-lime-700">✓ Target Reached!</span>
                        <span className="text-xs text-gray-600">Take a break or continue working</span>
                      </div>
                    )}
                  </div>
                )}

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Session notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
                />
                <div className="grid grid-cols-2 gap-4">
                  {isRunning ? (
                    <button
                      onClick={pauseSession}
                      className="flex items-center justify-center px-6 py-3 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition"
                    >
                      <Pause className="w-5 h-5 mr-2" />
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={resumeSession}
                      className="flex items-center justify-center px-6 py-3 bg-lime-600 text-white font-semibold rounded-lg hover:bg-lime-700 transition"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Resume
                    </button>
                  )}
                  <button
                    onClick={stopSession}
                    className="flex items-center justify-center px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition"
                  >
                    <StopCircle className="w-5 h-5 mr-2" />
                    Stop & Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Today</h3>
            <div className="text-4xl font-bold text-indigo-600 mb-1">
              {Math.floor(todayTotal / 60)} min
            </div>
            <div className="text-sm text-gray-500">{sessions.length} sessions</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Sessions</h3>
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No sessions yet</p>
              ) : (
                sessions.slice(0, 5).map(session => (
                  <div key={session.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900">
                        {Math.floor((session.duration || 0) / 60)} min
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(session.start_time).toLocaleTimeString()}
                      </span>
                    </div>
                    {session.notes && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{session.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Custom Preset Modal */}
      <CustomPresetModal
        isOpen={showPresetModal}
        onClose={() => setShowPresetModal(false)}
        presets={customPresets}
        onSave={handleSavePresets}
      />
    </div>
  );
}