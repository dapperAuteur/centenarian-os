/* eslint-disable @typescript-eslint/no-unused-vars */
// app/dashboard/engine/focus/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FocusSession, Task, PomodoroSettings, DEFAULT_POMODORO_SETTINGS, WorkInterval, BreakInterval, SessionTemplate, CreateTemplateInput } from '@/lib/types';
import SaveSessionAsTemplateButton from '@/components/focus/SaveSessionAsTemplateButton';
import { Play, Pause, StopCircle, Settings as SettingsIcon } from 'lucide-react';
import PomodoroPresets from '@/components/focus/PomodoroPresets';
import CustomPresetModal from '@/components/focus/CustomPresetModal';
import PomodoroSettingsModal from '@/components/focus/PomodoroSettingsModal';
import PomodoroTimer from '@/components/focus/PomodoroTimer';
import { getBreakDuration, calculatePomodoroStats, calculateNetWorkDuration } from '@/lib/utils/pomodoroUtils';
import TemplateQuickAccess from '@/components/focus/TemplateQuickAccess';
import TemplateManagerModal from '@/components/focus/TemplateManagerModal';
import CreateTemplateModal from '@/components/focus/CreateTemplateModal';
import DeleteTemplateModal from '@/components/focus/DeleteTemplateModal';
import QualityRatingModal from '@/components/focus/QualityRatingModal';

type TimerMode = 'simple' | 'pomodoro';
type PomodoroPhase = 'work' | 'short-break' | 'long-break';

export default function FocusTimerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [templateInitialData, setTemplateInitialData] = useState<{
    durationMinutes?: number;
    hourlyRate?: number;
    notesTemplate?: string;
    usePomodoro?: boolean;
  } | undefined>(undefined);
  
  // Pomodoro Presets
  const [customPresets, setCustomPresets] = useState<Array<{
    id: string;
    name: string;
    duration: number;
    description: string;
  }>>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetDuration, setPresetDuration] = useState<number | null>(null);
  const [targetDuration, setTargetDuration] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  // Pomodoro Mode State
  const [timerMode, setTimerMode] = useState<TimerMode>('simple');
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettings>(DEFAULT_POMODORO_SETTINGS);
  const [showPomodoroSettings, setShowPomodoroSettings] = useState(false);
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('work');
  const [currentPhaseSeconds, setCurrentPhaseSeconds] = useState(0);
  const [completedIntervals, setCompletedIntervals] = useState(0);
  const [workIntervals, setWorkIntervals] = useState<WorkInterval[]>([]);
  const [breakIntervals, setBreakIntervals] = useState<BreakInterval[]>([]);
  const [currentIntervalStart, setCurrentIntervalStart] = useState<string | null>(null);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null);
  const [deleteTemplateModal, setDeleteTemplateModal] = useState<{
    isOpen: boolean;
    template: SessionTemplate | null;
  }>({ isOpen: false, template: null });
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [pendingSessionEnd, setPendingSessionEnd] = useState<{
    sessionId: string;
    elapsedSeconds: number;
    revenue: number;
    notes: string;
  } | null>(null);
  
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
        
        // Restore Pomodoro state if applicable
        if (active.pomodoro_mode) {
          setTimerMode('pomodoro');
          setWorkIntervals(active.work_intervals || []);
          setBreakIntervals(active.break_intervals || []);
          // Determine current phase based on intervals
          const totalIntervals = (active.work_intervals?.length || 0) + (active.break_intervals?.length || 0);
          const isOnBreak = totalIntervals > 0 && totalIntervals % 2 === 1;
          setPomodoroPhase(isOnBreak ? 'short-break' : 'work');
        }
      }
    }
  }, [supabase]);

  const loadTemplates = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('session_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load templates:', error);
      return;
    }

    setTemplates(data || []);
  }, [supabase]);

  // Load custom presets and settings
  useEffect(() => {
    const savedPresets = localStorage.getItem('focus_custom_presets');
    if (savedPresets) {
      try {
        setCustomPresets(JSON.parse(savedPresets));
      } catch (err) {
        console.error('Failed to load custom presets:', err);
      }
    }

    const savedSettings = localStorage.getItem('pomodoro_settings');
    if (savedSettings) {
      try {
        setPomodoroSettings(JSON.parse(savedSettings));
      } catch (err) {
        console.error('Failed to load Pomodoro settings:', err);
      }
    }

    loadData();
    loadTemplates();
  }, [loadData, loadTemplates]);

  // Timer tick
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
        if (timerMode === 'pomodoro') {
          setCurrentPhaseSeconds(prev => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timerMode]);

  const handlePhaseComplete = useCallback(async () => {
    if (!currentSessionId || !currentIntervalStart) return;

    const endTime = new Date().toISOString();
    const duration = currentPhaseSeconds;

    if (pomodoroPhase === 'work') {
      // Complete work interval
      const newWorkInterval: WorkInterval = {
        start: currentIntervalStart,
        end: endTime,
        duration,
      };
      const updatedWorkIntervals = [...workIntervals, newWorkInterval];
      setWorkIntervals(updatedWorkIntervals);
      setCompletedIntervals(prev => prev + 1);

      // Save to database
      await supabase
        .from('focus_sessions')
        .update({
          work_intervals: updatedWorkIntervals,
          net_work_duration: calculateNetWorkDuration(updatedWorkIntervals, breakIntervals),
        })
        .eq('id', currentSessionId);

      // Determine next break type
      const breakInfo = getBreakDuration(completedIntervals + 1, pomodoroSettings);
      setPomodoroPhase(breakInfo.type === 'long' ? 'long-break' : 'short-break');
      setCurrentPhaseSeconds(0);
      setCurrentIntervalStart(endTime);

      // Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Work Complete! 🎉', {
          body: `Time for a ${breakInfo.type} break`,
          icon: '/favicon.ico',
        });
      }

      // Auto-start break if enabled
      if (!pomodoroSettings.autoStartBreaks) {
        setIsRunning(false);
      }
    } else {
      // Complete break interval
      const newBreakInterval: BreakInterval = {
        start: currentIntervalStart,
        end: endTime,
        duration,
        type: pomodoroPhase === 'long-break' ? 'long' : 'short',
      };
      const updatedBreakIntervals = [...breakIntervals, newBreakInterval];
      setBreakIntervals(updatedBreakIntervals);

      // Save to database
      await supabase
        .from('focus_sessions')
        .update({
          break_intervals: updatedBreakIntervals,
        })
        .eq('id', currentSessionId);

      // Start next work interval
      setPomodoroPhase('work');
      setCurrentPhaseSeconds(0);
      setCurrentIntervalStart(endTime);

      // Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Break Over! 💪', {
          body: 'Time to focus again',
          icon: '/favicon.ico',
        });
      }

      // Auto-start work if enabled
      if (!pomodoroSettings.autoStartWork) {
        setIsRunning(false);
      }
    }
  }, [
    currentSessionId,
    currentIntervalStart,
    pomodoroPhase,
    currentPhaseSeconds,
    workIntervals,
    breakIntervals,
    completedIntervals,
    pomodoroSettings,
    supabase,
    setWorkIntervals,
    setCompletedIntervals,
    setPomodoroPhase,
    setCurrentPhaseSeconds,
    setCurrentIntervalStart,
    setIsRunning,
    setBreakIntervals,
  ]);

  const handleUseTemplate = async (template: SessionTemplate) => {
    
    // Pre-fill form with template data
    setHourlyRate(template.hourly_rate);
    setNotes(template.notes_template || '');
    setSelectedTaskId('');
    
    if (template.use_pomodoro) {
      setTimerMode('pomodoro');
    } else {
      setTimerMode('simple');
      setPresetDuration(template.duration_minutes);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startTime = new Date().toISOString();

    const { data, error } = await supabase
      .from('focus_sessions')
      .insert([{
        user_id: user.id,
        task_id: null, // Templates don't pre-select tasks
        start_time: startTime,
        hourly_rate: template.hourly_rate,
        revenue: 0,
        pomodoro_mode: template.use_pomodoro,
        work_intervals: template.use_pomodoro ? [] : null,
        break_intervals: template.use_pomodoro ? [] : null,
        tags: template.tags?.length > 0 ? template.tags : null,
      }])
      .select()
      .single();

    if (data) {
      setCurrentSessionId(data.id);
      setIsRunning(true);
      setElapsedSeconds(0);
      
      if (template.use_pomodoro) {
        setPomodoroPhase('work');
        setCurrentPhaseSeconds(0);
        setCompletedIntervals(0);
        setWorkIntervals([]);
        setBreakIntervals([]);
        setCurrentIntervalStart(startTime);
      } else {
        setTargetDuration(template.duration_minutes * 60);
      }
    }
  };

  const handleCreateTemplate = async (input: CreateTemplateInput) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('session_templates')
      .insert([{
        user_id: user.id,
        ...input,
      }]);

    if (error) throw error;

    await loadTemplates();
  };

  const handleUpdateTemplate = async (input: CreateTemplateInput) => {
    if (!editingTemplate) return;

    const { error } = await supabase
      .from('session_templates')
      .update(input)
      .eq('id', editingTemplate.id);

    if (error) throw error;

    await loadTemplates();
    setEditingTemplate(null);
  };

  const handleSaveTemplate = async (input: CreateTemplateInput) => {
    if (editingTemplate) {
      await handleUpdateTemplate(input);
    } else {
      await handleCreateTemplate(input);
    }
  };

  const handleEditTemplate = (template: SessionTemplate) => {
    setEditingTemplate(template);
    setShowCreateTemplate(true);
  };

  const handleDeleteTemplateClick = (template: SessionTemplate) => {
    setDeleteTemplateModal({ isOpen: true, template });
  };

  const handleDeleteTemplateConfirm = async () => {
    if (!deleteTemplateModal.template) return;

    try {
      setIsDeletingTemplate(true);

      const { error } = await supabase
        .from('session_templates')
        .delete()
        .eq('id', deleteTemplateModal.template.id);

      if (error) throw error;

      await loadTemplates();
      setDeleteTemplateModal({ isOpen: false, template: null });
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template. Please try again.');
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  const handleOpenTemplateManager = () => {
    setShowTemplateManager(true);
  };

  const handleCreateNewTemplate = () => {
    setEditingTemplate(null);
    setShowCreateTemplate(true);
    setShowTemplateManager(false);
  };

  // Pomodoro phase completion check
  useEffect(() => {
    if (!isRunning || timerMode !== 'pomodoro') return;

    const phaseTargets = {
      work: pomodoroSettings.workDuration * 60,
      'short-break': pomodoroSettings.shortBreakDuration * 60,
      'long-break': pomodoroSettings.longBreakDuration * 60,
    };

    const targetSeconds = phaseTargets[pomodoroPhase];

    if (currentPhaseSeconds >= targetSeconds) {
      handlePhaseComplete();
    }
  }, [currentPhaseSeconds, pomodoroPhase, timerMode, isRunning, pomodoroSettings, handlePhaseComplete]);

  const handleSavePresets = (presets: typeof customPresets) => {
    setCustomPresets(presets);
    localStorage.setItem('focus_custom_presets', JSON.stringify(presets));
  };

  const handleSavePomodoroSettings = (settings: PomodoroSettings) => {
    setPomodoroSettings(settings);
    localStorage.setItem('pomodoro_settings', JSON.stringify(settings));
  };

  const handlePresetSelect = (duration: number) => {
    setPresetDuration(duration);
  };

  const startSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startTime = new Date().toISOString();

    const { data, error } = await supabase
      .from('focus_sessions')
      .insert([{
        user_id: user.id,
        task_id: selectedTaskId || null,
        start_time: startTime,
        hourly_rate: hourlyRate,
        revenue: 0,
        pomodoro_mode: timerMode === 'pomodoro',
        work_intervals: timerMode === 'pomodoro' ? [] : null,
        break_intervals: timerMode === 'pomodoro' ? [] : null,
      }])
      .select()
      .single();

    if (data) {
      setCurrentSessionId(data.id);
      setIsRunning(true);
      setElapsedSeconds(0);
      
      if (timerMode === 'simple' && presetDuration) {
        setTargetDuration(presetDuration * 60);
        setPresetDuration(null);
      } else if (timerMode === 'pomodoro') {
        setPomodoroPhase('work');
        setCurrentPhaseSeconds(0);
        setCompletedIntervals(0);
        setWorkIntervals([]);
        setBreakIntervals([]);
        setCurrentIntervalStart(startTime);
      }
    }
  };

  const pauseSession = () => {
    setIsRunning(false);
  };

  const resumeSession = () => {
    setIsRunning(true);
  };

  const skipPhase = async () => {
    if (!isRunning) return;
    await handlePhaseComplete();
  };

  const stopSession = async () => {
  if (!currentSessionId) return;
  
  const revenueEarned = (elapsedSeconds / 3600) * hourlyRate;

  // Store session data and show quality modal
  setPendingSessionEnd({
    sessionId: currentSessionId,
    elapsedSeconds: elapsedSeconds,
    revenue: revenueEarned,
    notes: notes,
  });
  setShowQualityModal(true);
};

const handleQualityRating = async (rating: number) => {
  if (!pendingSessionEnd) return;

  try {
    // If in Pomodoro mode and currently working, save the current work interval
    if (timerMode === 'pomodoro' && pomodoroPhase === 'work' && currentIntervalStart) {
      const newWorkInterval: WorkInterval = {
        start: currentIntervalStart,
        end: new Date().toISOString(),
        duration: currentPhaseSeconds,
      };
      const finalWorkIntervals = [...workIntervals, newWorkInterval];

      const netWorkDuration = calculateNetWorkDuration(finalWorkIntervals, breakIntervals);
      const revenueEarned = (netWorkDuration / 3600) * hourlyRate;

      await supabase
        .from('focus_sessions')
        .update({
          end_time: new Date().toISOString(),
          duration: pendingSessionEnd.elapsedSeconds,
          net_work_duration: netWorkDuration,
          revenue: revenueEarned,
          notes: pendingSessionEnd.notes || null,
          work_intervals: finalWorkIntervals,
          break_intervals: breakIntervals,
          quality_rating: rating,
        })
        .eq('id', pendingSessionEnd.sessionId);
    } else {
      // Simple mode
      await supabase
        .from('focus_sessions')
        .update({
          end_time: new Date().toISOString(),
          duration: pendingSessionEnd.elapsedSeconds,
          revenue: pendingSessionEnd.revenue,
          notes: pendingSessionEnd.notes || null,
          quality_rating: rating,
        })
        .eq('id', pendingSessionEnd.sessionId);
    }

    // Reset state
    setShowQualityModal(false);
    setPendingSessionEnd(null);
    setIsRunning(false);
    setCurrentSessionId(null);
    setElapsedSeconds(0);
    setNotes('');
    setTargetDuration(null);
    setPomodoroPhase('work');
    setCurrentPhaseSeconds(0);
    setCompletedIntervals(0);
    setWorkIntervals([]);
    setBreakIntervals([]);
    setCurrentIntervalStart(null);
    
    await loadData();
  } catch (error) {
    console.error('Failed to save quality rating:', error);
  }
};

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const targetReached = targetDuration && elapsedSeconds >= targetDuration;

  const todayTotal = sessions
    .filter(s => s.duration)
    .reduce((sum, s) => sum + (s.duration || 0), 0);

  // Calculate Pomodoro stats
  const pomodoroStats = timerMode === 'pomodoro' && currentSessionId
    ? calculatePomodoroStats(workIntervals, breakIntervals)
    : null;

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Focus Timer</h1>
        <p className="text-gray-600">Track deep work with Pomodoro technique</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timer */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Mode Toggle */}
            {!currentSessionId && (
              <div className="flex items-center justify-center space-x-4 mb-6">
                <button
                  onClick={() => setTimerMode('simple')}
                  className={`px-6 py-3 rounded-lg font-semibold transition ${
                    timerMode === 'simple'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Simple Timer
                </button>
                <button
                  onClick={() => setTimerMode('pomodoro')}
                  className={`px-6 py-3 rounded-lg font-semibold transition ${
                    timerMode === 'pomodoro'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🍅 Pomodoro Mode
                </button>
                <button
                  onClick={() => setShowPomodoroSettings(true)}
                  className="p-3 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  title="Pomodoro Settings"
                >
                  <SettingsIcon className="w-5 h-5" />
                </button>
              </div>
            )}
            <TemplateQuickAccess
              templates={templates}
              onUse={handleUseTemplate}
              onManage={handleOpenTemplateManager}
              onEdit={handleEditTemplate}
              onDelete={handleDeleteTemplateClick}
              maxVisible={4}
            />

            {/* Divider */}
            {templates.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-white text-sm text-gray-500">or start manually</span>
                </div>
              </div>
            )}

            {/* Timer Display */}
            {currentSessionId && timerMode === 'pomodoro' ? (
              <PomodoroTimer
                phase={pomodoroPhase}
                seconds={currentPhaseSeconds}
                targetSeconds={
                  pomodoroPhase === 'work'
                    ? pomodoroSettings.workDuration * 60
                    : pomodoroPhase === 'short-break'
                    ? pomodoroSettings.shortBreakDuration * 60
                    : pomodoroSettings.longBreakDuration * 60
                }
                completedIntervals={completedIntervals}
                settings={pomodoroSettings}
                isRunning={isRunning}
                onSkip={skipPhase}
              />
            ) : (
              <div className="text-center mb-8">
                <div className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-4 font-mono">
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
            )}

            {/* Pomodoro Stats during session */}
            {pomodoroStats && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Completed</p>
                    <p className="text-lg font-bold text-indigo-600">
                      {pomodoroStats.completedPomodoros} 🍅
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Net Work</p>
                    <p className="text-lg font-bold text-lime-600">
                      {Math.floor(pomodoroStats.totalWorkSeconds / 60)}m
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Breaks</p>
                    <p className="text-lg font-bold text-amber-600">
                      {pomodoroStats.shortBreaks + pomodoroStats.longBreaks}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Controls */}
            {!currentSessionId ? (
              <div className="space-y-4">
                {timerMode === 'simple' && (
                  <>
                    <PomodoroPresets
                      onSelectPreset={handlePresetSelect}
                      onOpenCustom={() => setShowPresetModal(true)}
                      disabled={false}
                    />

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
                  </>
                )}

                {timerMode === 'pomodoro' && (
                  <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-gray-900 mb-2">
                      🍅 Pomodoro Cycle
                    </p>
                    <div className="text-xs text-gray-700 space-y-1">
                      <p>• Work: {pomodoroSettings.workDuration} min</p>
                      <p>• Short Break: {pomodoroSettings.shortBreakDuration} min (×{pomodoroSettings.intervalsBeforeLongBreak - 1})</p>
                      <p>• Long Break: {pomodoroSettings.longBreakDuration} min (every {pomodoroSettings.intervalsBeforeLongBreak} pomodoros)</p>
                    </div>
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
                    Tags (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Tags (comma-separated: coding, design, planning)"
                    onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()))}
                    className="w-full px-4 py-2 border rounded-lg form-input"
                  />
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
                  <p className="text-xs text-gray-500 mt-1">
                    {timerMode === 'pomodoro' 
                      ? 'Revenue calculated from net work time (excludes breaks)'
                      : 'Track billable time value'}
                  </p>
                </div>
                <button
                  onClick={startSession}
                  className="w-full flex items-center justify-center px-6 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-lg hover:bg-indigo-700 transition"
                >
                  <Play className="w-6 h-6 mr-2" />
                  Start {timerMode === 'pomodoro' ? 'Pomodoro' : 'Focus Session'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {timerMode === 'simple' && targetDuration && (
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
                {currentSessionId && (
                  <>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Session notes..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
                    />

                    {/* ✅ Add Save as Template button */}
                    <SaveSessionAsTemplateButton
                      sessionData={{
                        duration: elapsedSeconds,
                        hourlyRate,
                        notes,
                        usePomodoro: timerMode === 'pomodoro',
                      }}
                      onSave={() => {
                        setTemplateInitialData({
                          durationMinutes: Math.floor(elapsedSeconds / 60),
                          hourlyRate,
                          notesTemplate: notes,
                          usePomodoro: timerMode === 'pomodoro',
                        });
                        setEditingTemplate(null);
                        setShowCreateTemplate(true);
                      }}
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

                  </>
                )}
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
                      <div className="flex items-center space-x-2">
                        {session.pomodoro_mode && <span>🍅</span>}
                        <span className="text-sm font-medium text-gray-900">
                          {Math.floor((session.net_work_duration || session.duration || 0) / 60)} min
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(session.start_time).toLocaleTimeString()}
                      </span>
                    </div>
                    {session.pomodoro_mode && session.work_intervals && (
                      <p className="text-xs text-gray-600 mt-1">
                        {session.work_intervals.length} pomodoros completed
                      </p>
                    )}
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

      {/* Modals */}
      <CustomPresetModal
        isOpen={showPresetModal}
        onClose={() => setShowPresetModal(false)}
        presets={customPresets}
        onSave={handleSavePresets}
      />

      <PomodoroSettingsModal
        isOpen={showPomodoroSettings}
        onClose={() => setShowPomodoroSettings(false)}
        settings={pomodoroSettings}
        onSave={handleSavePomodoroSettings}
      />
      {/* Template Manager Modal */}
      <TemplateManagerModal
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        templates={templates}
        onUse={handleUseTemplate}
        onCreate={handleCreateNewTemplate}
        onEdit={handleEditTemplate}
        onDelete={handleDeleteTemplateClick}
      />

      {/* Create/Edit Template Modal */}
      <CreateTemplateModal
        isOpen={showCreateTemplate}
        onClose={() => {
          setShowCreateTemplate(false);
          setEditingTemplate(null);
          setTemplateInitialData(undefined);
        }}
        onSave={handleSaveTemplate}
        editTemplate={editingTemplate}
        initialData={templateInitialData}
      />

      {/* Delete Template Confirmation */}
      <DeleteTemplateModal
        isOpen={deleteTemplateModal.isOpen}
        onClose={() => setDeleteTemplateModal({ isOpen: false, template: null })}
        onConfirm={handleDeleteTemplateConfirm}
        template={deleteTemplateModal.template}
        isDeleting={isDeletingTemplate}
      />
      {/* Quality Rating Modal */}
      <QualityRatingModal
        isOpen={showQualityModal}
        onClose={() => {
          setShowQualityModal(false);
          setPendingSessionEnd(null);
        }}
        onSubmit={handleQualityRating}
      />
    </div>
  );
}