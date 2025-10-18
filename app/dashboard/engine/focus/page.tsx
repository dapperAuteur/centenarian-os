/* eslint-disable @typescript-eslint/no-unused-vars */
// File: app/dashboard/engine/focus/page.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FocusSession, Task } from '@/lib/types';
import { Play, Pause, StopCircle } from 'lucide-react';

export default function FocusTimerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notes, setNotes] = useState('');
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

  useEffect(() => {
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
        duration_seconds: elapsedSeconds,
        revenue: revenueEarned,
        notes: notes || null,
      })
      .eq('id', currentSessionId);

    setIsRunning(false);
    setCurrentSessionId(null);
    setElapsedSeconds(0);
    setNotes('');
    loadData();
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const todayTotal = sessions
    .filter(s => s.duration_seconds)
    .reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link to Task (optional)
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Session notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                    Stop
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats & History */}
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
              {sessions.slice(0, 5).map(session => (
                <div key={session.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900">
                      {Math.floor((session.duration_seconds || 0) / 60)} min
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(session.start_time).toLocaleTimeString()}
                    </span>
                  </div>
                  {session.notes && (
                    <p className="text-xs text-gray-600 mt-1">{session.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}