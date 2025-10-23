// app/dashboard/engine/focus/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FocusSession, Task } from '@/lib/types';
import { Play, Pause, StopCircle, AlertCircle, Settings } from 'lucide-react';
import { timerStorage, TimerState } from '@/lib/utils/timerStorage';
import GoalProgressWidget from '@/components/focus/GoalProgressWidget';
import GoalSettingsModal from '@/components/focus/GoalSettingsModal';
import { calculateDailyProgress, calculateWeeklyProgress } from '@/lib/utils/goalUtils';
import GoalStreakTracker from '@/components/focus/GoalStreakTracker';

export default function FocusTimerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showGoalSettings, setShowGoalSettings] = useState(false);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(120);
  const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(840);
  
  const pauseStartRef = useRef<number | null>(null);
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
    if (sessionsRes.data) setSessions(sessionsRes.data);
  }, [supabase]);

  const dailyProgress = calculateDailyProgress(sessions, dailyGoalMinutes);
  const weeklyProgress = calculateWeeklyProgress(sessions, weeklyGoalMinutes, dailyGoalMinutes);

  // 5. Save goals function
const handleSaveGoals = async (daily: number, weekly: number) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: user.id,
      daily_focus_goal_minutes: daily,
      weekly_focus_goal_minutes: weekly,
    });

  if (error) throw error;

  setDailyGoalMinutes(daily);
  setWeeklyGoalMinutes(weekly);
};

  useEffect(() => {
  const loadGoals = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('daily_focus_goal_minutes, weekly_focus_goal_minutes')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      setDailyGoalMinutes(profile.daily_focus_goal_minutes || 120);
      setWeeklyGoalMinutes(profile.weekly_focus_goal_minutes || 840);
    }
  };

  loadData();
  loadGoals();
}, [loadData, supabase]);

  // Restore timer on mount
  useEffect(() => {
    // Add this to app/dashboard/engine/focus/page.tsx inside the restoreTimer function:

const restoreTimer = () => {
  const savedState = timerStorage.load();
  
  if (savedState) {
    // Calculate elapsed time
    const elapsed = timerStorage.getElapsedSeconds(savedState);
    
    // CRITICAL: Check if session is stale (>24 hours)
    if (elapsed > 86400) {
      // Session older than 24 hours - likely abandoned
      if (confirm(
        `Found a session that has been running for ${Math.floor(elapsed / 3600)} hours. ` +
        `This seems unusual. Would you like to stop it now?`
      )) {
        // User wants to stop - redirect to sessions page
        timerStorage.clear();
        window.location.href = '/dashboard/engine/sessions';
        return;
      } else {
        // User wants to keep it running
        setCurrentSessionId(savedState.sessionId);
        setSelectedTaskId(savedState.taskId || '');
        setNotes(savedState.notes);
        setHourlyRate(savedState.hourlyRate);
        setElapsedSeconds(elapsed);
        setIsRunning(!savedState.pausedAt);
      }
    } else {
      // Normal session - restore as usual
      setCurrentSessionId(savedState.sessionId);
      setSelectedTaskId(savedState.taskId || '');
      setNotes(savedState.notes);
      setHourlyRate(savedState.hourlyRate);
      setElapsedSeconds(elapsed);
      setIsRunning(!savedState.pausedAt);
    }
  }
};

    loadData();
    restoreTimer();
  }, [loadData]);

  // Timer tick
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && currentSessionId) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => {
          const newValue = prev + 1;
          
          if (newValue % 10 === 0) {
            const state = timerStorage.load();
            if (state) {
              timerStorage.save(state);
            }
          }
          
          return newValue;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, currentSessionId]);

  // Save notes to storage
  useEffect(() => {
    if (currentSessionId && notes) {
      timerStorage.updateNotes(notes);
    }
  }, [notes, currentSessionId]);

  const startSession = async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const startTime = new Date().toISOString();
      
      const { data, error: insertError } = await supabase
        .from('focus_sessions')
        .insert([{
          user_id: user.id,
          task_id: selectedTaskId || null,
          start_time: startTime,
          hourly_rate: hourlyRate,
          revenue: 0,
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Insert error details:', insertError);
        throw insertError;
      }
      if (!data) throw new Error('Failed to create session');

      const timerState: TimerState = {
        sessionId: data.id,
        taskId: selectedTaskId || null,
        startTime: startTime,
        pausedAt: null,
        totalPausedSeconds: 0,
        notes: '',
        hourlyRate: hourlyRate,
      };
      timerStorage.save(timerState);

      setCurrentSessionId(data.id);
      setIsRunning(true);
      setElapsedSeconds(0);
    } catch (err) {
      console.error('Start session error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  const pauseSession = () => {
    setIsRunning(false);
    pauseStartRef.current = Date.now();
    timerStorage.updatePauseState(new Date().toISOString());
  };

  const resumeSession = () => {
    if (pauseStartRef.current) {
      const pauseDuration = Math.floor((Date.now() - pauseStartRef.current) / 1000);
      timerStorage.updatePauseState(null, pauseDuration);
      pauseStartRef.current = null;
    }
    setIsRunning(true);
  };

  const stopSession = async () => {
    if (!currentSessionId) {
      setError('No active session to stop');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const endTime = new Date().toISOString();
      const revenueEarned = (elapsedSeconds / 3600) * hourlyRate;

      // FIXED: Column is "duration" not "duration_seconds"
      const updatePayload = {
        end_time: endTime,
        duration: elapsedSeconds,  // ✅ Correct column name
        revenue: revenueEarned,
        notes: notes || null,
      };

      console.log('Updating session:', currentSessionId, updatePayload);

      const { error: updateError } = await supabase
        .from('focus_sessions')
        .update(updatePayload)
        .eq('id', currentSessionId);

      if (updateError) {
        console.error('Update error details:', updateError);
        throw updateError;
      }

      timerStorage.clear();

      setIsRunning(false);
      setCurrentSessionId(null);
      setElapsedSeconds(0);
      setNotes('');
      pauseStartRef.current = null;

      await loadData();
    } catch (err) {
      console.error('Stop session error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save session');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const todayTotal = sessions
    .filter(s => s.duration)
    .reduce((sum, s) => sum + (s.duration || 0), 0);

  const todayRevenue = sessions
    .filter(s => s.revenue)
    .reduce((sum, s) => sum + (s.revenue || 0), 0);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Focus Timer</h1>
        <p className="text-gray-600">Track deep work sessions linked to tasks</p>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

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
                    disabled={isSaving}
                    className="flex items-center justify-center px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <StopCircle className="w-5 h-5 mr-2" />
                    {isSaving ? 'Saving...' : 'Stop & Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats & History */}
        <div className="space-y-6">
          {/* Settings Button */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Progress & Stats</h3>
            <button
              onClick={() => setShowGoalSettings(true)}
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
              title="Goal Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Goal Progress Widgets */}
          <GoalProgressWidget
            title="Today's Goal"
            completedMinutes={dailyProgress.completedMinutes}
            goalMinutes={dailyProgress.goalMinutes}
            percentage={dailyProgress.percentage}
            icon="target"
          />

          <GoalProgressWidget
            title="This Week"
            completedMinutes={weeklyProgress.completedMinutes}
            goalMinutes={weeklyProgress.goalMinutes}
            percentage={weeklyProgress.percentage}
            icon="calendar"
          />

          <GoalStreakTracker
            sessions={sessions}
            dailyGoalMinutes={dailyGoalMinutes}
          />

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
                    {session.revenue && session.revenue > 0 && (
                      <div className="text-xs text-lime-600 font-semibold mt-1">
                        ${session.revenue.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <GoalSettingsModal
        isOpen={showGoalSettings}
        onClose={() => setShowGoalSettings(false)}
        currentDailyGoal={dailyGoalMinutes}
        currentWeeklyGoal={weeklyGoalMinutes}
        onSave={handleSaveGoals}
      />
    </div>
  );
}