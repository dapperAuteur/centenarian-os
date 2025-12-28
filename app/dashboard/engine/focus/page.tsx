/* eslint-disable @typescript-eslint/no-explicit-any */
// app/dashboard/engine/focus/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FocusSession, Task, PomodoroSettings, DEFAULT_POMODORO_SETTINGS, WorkInterval, BreakInterval, SessionTemplate, CreateTemplateInput, SessionType } from '@/lib/types';
import SaveSessionAsTemplateButton from '@/components/focus/SaveSessionAsTemplateButton';
import SessionTypeToggle from '@/components/focus/SessionTypeToggle';
import { Play, Pause, StopCircle, Settings as SettingsIcon } from 'lucide-react';
import PomodoroPresets from '@/components/focus/PomodoroPresets';
import CustomPresetModal from '@/components/focus/CustomPresetModal';
import PomodoroSettingsModal from '@/components/focus/PomodoroSettingsModal';
import PomodoroTimer from '@/components/focus/PomodoroTimer';
import { getBreakDuration, calculateNetWorkDuration } from '@/lib/utils/pomodoroUtils';
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
  const [sessionType, setSessionType] = useState<SessionType>('focus');
  
  // Pomodoro presets
  const [customPresets, setCustomPresets] = useState<Array<{ id: string; name: string; duration: number; description: string; }>>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetDuration, setPresetDuration] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  // Timer modes
  const [timerMode, setTimerMode] = useState<TimerMode>('simple');
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettings>(DEFAULT_POMODORO_SETTINGS);
  const [showPomodoroSettings, setShowPomodoroSettings] = useState(false);
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('work');
  const [currentPhaseSeconds, setCurrentPhaseSeconds] = useState(0);
  const [completedIntervals, setCompletedIntervals] = useState(0);
  const [workIntervals, setWorkIntervals] = useState<WorkInterval[]>([]);
  const [breakIntervals, setBreakIntervals] = useState<BreakInterval[]>([]);
  const [currentIntervalStart, setCurrentIntervalStart] = useState<string | null>(null);

  // Templates
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null);
  const [deleteTemplateModal, setDeleteTemplateModal] = useState<{ isOpen: boolean; template: SessionTemplate | null; }>({ isOpen: false, template: null });
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);

  // Quality rating
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [pendingSessionEnd, setPendingSessionEnd] = useState<{ sessionId: string; elapsedSeconds: number; revenue: number; notes: string; } | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const [tasksRes, sessionsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('date', today).eq('completed', false).order('time'),
      supabase.from('focus_sessions').select('*').gte('start_time', today + 'T00:00:00').order('start_time', { ascending: false })
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (sessionsRes.data) {
      setSessions(sessionsRes.data);
      const active = sessionsRes.data.find(s => !s.end_time);
      if (active) {
        setCurrentSessionId(active.id);
        setSelectedTaskId(active.task_id || '');
        setIsRunning(true);
        const elapsed = Math.floor((Date.now() - new Date(active.start_time).getTime()) / 1000);
        setElapsedSeconds(elapsed);
        
        if (active.pomodoro_mode) {
          setTimerMode('pomodoro');
          setWorkIntervals(active.work_intervals || []);
          setBreakIntervals(active.break_intervals || []);
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

    const { data, error } = await supabase.from('session_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load templates:', error);
      return;
    }
    setTemplates(data || []);
  }, [supabase]);

  useEffect(() => {
    const savedPresets = localStorage.getItem('focus_custom_presets');
    if (savedPresets) {
      try {
        setCustomPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error('Failed to parse custom presets:', e);
      }
    }

    const savedSettings = localStorage.getItem('pomodoro_settings');
    if (savedSettings) {
      try {
        setPomodoroSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to parse pomodoro settings:', e);
      }
    }

    loadData();
    loadTemplates();
  }, [loadData, loadTemplates]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        if (timerMode === 'pomodoro') {
          setCurrentPhaseSeconds(prev => prev + 1);
          const targetSeconds = pomodoroPhase === 'work' ? pomodoroSettings.workDuration * 60 : pomodoroPhase === 'short-break' ? pomodoroSettings.shortBreakDuration * 60 : pomodoroSettings.longBreakDuration * 60;

          if (currentPhaseSeconds + 1 >= targetSeconds) {
            handleCompleteCurrentInterval();
          }
        } else {
          setElapsedSeconds(prev => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timerMode, pomodoroPhase, currentPhaseSeconds, pomodoroSettings]);

  const handleCompleteCurrentInterval = useCallback(async () => {
    if (!currentSessionId) return;

    const endTime = new Date().toISOString();
    const duration = currentPhaseSeconds;

    if (pomodoroPhase === 'work') {
      const newWorkInterval: WorkInterval = { start: currentIntervalStart!, end: endTime, duration };
      const updatedWorkIntervals = [...workIntervals, newWorkInterval];
      setWorkIntervals(updatedWorkIntervals);

      const newCompletedIntervals = completedIntervals + 1;
      setCompletedIntervals(newCompletedIntervals);

      await supabase.from('focus_sessions').update({ work_intervals: updatedWorkIntervals }).eq('id', currentSessionId);

      const breakInfo = getBreakDuration(newCompletedIntervals, pomodoroSettings);
      setCurrentPhaseSeconds(0);
      setPomodoroPhase(breakInfo.type === 'long' ? 'long-break' : 'short-break');
      setCurrentIntervalStart(endTime);

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Work Complete! 🎉', { body: `Time for a ${breakInfo.type} break` });
      }

      if (!pomodoroSettings.autoStartBreaks) setIsRunning(false);
    } else {
      const newBreakInterval: BreakInterval = { start: currentIntervalStart!, end: endTime, duration, type: pomodoroPhase === 'long-break' ? 'long' : 'short' };
      const updatedBreakIntervals = [...breakIntervals, newBreakInterval];
      setBreakIntervals(updatedBreakIntervals);

      await supabase.from('focus_sessions').update({ break_intervals: updatedBreakIntervals }).eq('id', currentSessionId);

      setCurrentPhaseSeconds(0);
      setPomodoroPhase('work');
      setCurrentIntervalStart(endTime);

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Break Over! 💪', { body: 'Time to focus again' });
      }

      if (!pomodoroSettings.autoStartWork) setIsRunning(false);
    }
  }, [currentSessionId, currentIntervalStart, pomodoroPhase, currentPhaseSeconds, workIntervals, breakIntervals, completedIntervals, pomodoroSettings, supabase]);

  const startSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startTime = new Date().toISOString();
    const { data, error } = await supabase.from('focus_sessions').insert([{
      user_id: user.id,
      task_id: selectedTaskId || null,
      start_time: startTime,
      hourly_rate: hourlyRate,
      revenue: 0,
      session_type: sessionType,
      pomodoro_mode: timerMode === 'pomodoro',
      work_intervals: timerMode === 'pomodoro' ? [] : null,
      break_intervals: timerMode === 'pomodoro' ? [] : null,
      tags: tags.length > 0 ? tags : null,
    }]).select().single();

    if (error) {
      console.error('Failed to start session:', error);
      return;
    }

    setCurrentSessionId(data.id);
    setIsRunning(true);

    if (timerMode === 'pomodoro') {
      setCurrentIntervalStart(startTime);
      setPomodoroPhase('work');
      setCurrentPhaseSeconds(0);
      setCompletedIntervals(0);
      setWorkIntervals([]);
      setBreakIntervals([]);
    } else {
      setElapsedSeconds(0);
    }

    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  };

  const stopSession = async () => {
    if (!currentSessionId) return;

    const endTime = new Date().toISOString();
    const duration = timerMode === 'pomodoro' ? calculateNetWorkDuration(workIntervals, []) : elapsedSeconds;
    const revenue = hourlyRate > 0 ? (hourlyRate / 3600) * duration : 0;

    const updateData: any = {
      end_time: endTime,
      duration,
      revenue,
      notes: notes || null,
    };

    if (timerMode === 'pomodoro') {
      updateData.net_work_duration = duration;
    }

    const { error } = await supabase.from('focus_sessions').update(updateData).eq('id', currentSessionId);

    if (error) {
      console.error('Failed to stop session:', error);
      return;
    }

    if (sessionType === 'focus') {
      setPendingSessionEnd({ sessionId: currentSessionId, elapsedSeconds: duration, revenue, notes });
      setShowQualityModal(true);
    } else {
      resetSession();
      await loadData();
    }
  };

  const resetSession = () => {
    setIsRunning(false);
    setCurrentSessionId(null);
    setElapsedSeconds(0);
    setCurrentPhaseSeconds(0);
    setNotes('');
    setSelectedTaskId('');
    setTags([]);
  };

  const handleSaveQuality = async (rating: number) => {
    if (pendingSessionEnd) {
      await supabase.from('focus_sessions').update({ quality_rating: rating }).eq('id', pendingSessionEnd.sessionId);
      setPendingSessionEnd(null);
      setShowQualityModal(false);
      resetSession();
      await loadData();
    }
  };

  const handleUseTemplate = async (template: SessionTemplate) => {
    setHourlyRate(template.hourly_rate || 0);
    setNotes(template.notes_template ?? '');
    setTags(template.tags || []);
    
    if (template.use_pomodoro) {
      setTimerMode('pomodoro');
    } else {
      setTimerMode('simple');
      if (template.duration_minutes) {
        setPresetDuration(template.duration_minutes);
      }
    }
  };

  const handleSaveTemplate = async (templateData: CreateTemplateInput) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingTemplate) {
      const { error } = await supabase.from('session_templates').update(templateData).eq('id', editingTemplate.id);
      if (error) {
        console.error('Failed to update template:', error);
        alert('Failed to update template');
        return;
      }
    } else {
      const { error } = await supabase.from('session_templates').insert([{ ...templateData, user_id: user.id }]);
      if (error) {
        console.error('Failed to create template:', error);
        alert('Failed to create template');
        return;
      }
    }

    setShowCreateTemplate(false);
    setEditingTemplate(null);
    await loadTemplates();
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateModal.template) return;
    
    setIsDeletingTemplate(true);
    const { error } = await supabase.from('session_templates').delete().eq('id', deleteTemplateModal.template.id);
    setIsDeletingTemplate(false);

    if (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    } else {
      setDeleteTemplateModal({ isOpen: false, template: null });
      await loadTemplates();
    }
  };

  const handleSaveCustomPresets = (presets: any[]) => {
    setCustomPresets(presets);
    localStorage.setItem('focus_custom_presets', JSON.stringify(presets));
    setShowPresetModal(false);
  };

  const handleSavePomodoroSettings = (settings: PomodoroSettings) => {
    setPomodoroSettings(settings);
    localStorage.setItem('pomodoro_settings', JSON.stringify(settings));
    setShowPomodoroSettings(false);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Focus Timer</h1>
        <p className="text-gray-600">Track your deep work sessions</p>
      </header>

      {!isRunning && templates.length > 0 && (
        <TemplateQuickAccess 
          templates={templates}
          onUse={handleUseTemplate}
          onManage={() => setShowTemplateManager(true)} onEdit={function (template: SessionTemplate): void {
            throw new Error('Function not implemented.');
          } } onDelete={function (template: SessionTemplate): void {
            throw new Error('Function not implemented.');
          } }        />
      )}

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        {!isRunning && !currentSessionId && (
          <div className="mb-6">
            <SessionTypeToggle value={sessionType} onChange={setSessionType} />
          </div>
        )}

        {!isRunning && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Timer Mode</h3>
              {timerMode === 'pomodoro' && (
                <button onClick={() => setShowPomodoroSettings(true)} className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                  <SettingsIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button onClick={() => setTimerMode('simple')} className={`p-4 rounded-lg border-2 transition ${timerMode === 'simple' ? 'bg-indigo-50 border-indigo-600 text-indigo-900' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                <div className="text-sm font-bold mb-1">Simple Timer</div>
                <div className="text-xs text-gray-600">Continuous focus session</div>
              </button>
              <button onClick={() => setTimerMode('pomodoro')} className={`p-4 rounded-lg border-2 transition ${timerMode === 'pomodoro' ? 'bg-red-50 border-red-600 text-red-900' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                <div className="text-sm font-bold mb-1">🍅 Pomodoro</div>
                <div className="text-xs text-gray-600">Work + break cycles</div>
              </button>
            </div>

            {timerMode === 'simple' && (
              <PomodoroPresets 
                onSelectPreset={(minutes) => setPresetDuration(minutes)} 
                onOpenCustom={() => setShowPresetModal(true)}
              />
            )}
          </div>
        )}

        <div className="text-center mb-6">
          <div className="text-6xl font-bold text-gray-900 mb-4">
            {timerMode === 'pomodoro' ? formatTime(currentPhaseSeconds) : formatTime(elapsedSeconds)}
          </div>
          
          {timerMode === 'pomodoro' && isRunning && (
            <PomodoroTimer 
              phase={pomodoroPhase} 
              seconds={currentPhaseSeconds} 
              targetSeconds={pomodoroPhase === 'work' ? pomodoroSettings.workDuration * 60 : pomodoroPhase === 'short-break' ? pomodoroSettings.shortBreakDuration * 60 : pomodoroSettings.longBreakDuration * 60} 
              completedIntervals={completedIntervals} 
              settings={pomodoroSettings} 
              isRunning={isRunning} 
              onSkip={handleCompleteCurrentInterval} 
            />
          )}
        </div>

        <div className="flex justify-center gap-4 mb-6">
          {!isRunning ? (
            <button onClick={startSession} className="flex items-center space-x-2 px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
              <Play className="w-5 h-5" />
              <span>Start</span>
            </button>
          ) : (
            <>
              <button onClick={() => setIsRunning(false)} className="flex items-center space-x-2 px-8 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition">
                <Pause className="w-5 h-5" />
                <span>Pause</span>
              </button>
              <button onClick={stopSession} className="flex items-center space-x-2 px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                <StopCircle className="w-5 h-5" />
                <span>Stop</span>
              </button>
            </>
          )}
        </div>

        {!isRunning && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link to Task (Optional)</label>
              <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="">No task selected</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>{task.activity} - {task.date}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
              <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div className="flex flex-wrap gap-2">
                {['deep-work', 'meeting', 'admin', 'learning', 'creative', 'coding', 'planning', 'review'].map(tag => (
                  <button key={tag} onClick={() => toggleTag(tag)} className={`px-3 py-1 rounded-full text-sm transition ${tags.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>

            <SaveSessionAsTemplateButton onSave={() => setShowCreateTemplate(true)} sessionData={{
              duration: 0,
              hourlyRate: 0,
              notes: '',
              tags: undefined,
              usePomodoro: false
            }} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No sessions yet</p>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => (
              <div key={session.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-xs font-semibold uppercase px-2 py-1 rounded ${session.session_type === 'focus' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
                      {session.session_type || 'focus'}
                    </span>
                    <p className="text-sm text-gray-600 mt-1">{new Date(session.start_time).toLocaleString()}</p>
                    {session.notes && <p className="text-sm text-gray-700 mt-2">{session.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {session.duration ? `${Math.round(session.duration / 60)}m` : 'Active'}
                    </p>
                    {session.revenue != null && session.revenue > 0 && (
                      <p className="text-sm text-green-600">${session.revenue.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CustomPresetModal isOpen={showPresetModal} onClose={() => setShowPresetModal(false)} onSave={handleSaveCustomPresets} presets={customPresets} />
      <PomodoroSettingsModal isOpen={showPomodoroSettings} onClose={() => setShowPomodoroSettings(false)} settings={pomodoroSettings} onSave={handleSavePomodoroSettings} />
      <TemplateManagerModal isOpen={showTemplateManager} onClose={() => setShowTemplateManager(false)} templates={templates} onUse={handleUseTemplate} onCreate={() => setShowCreateTemplate(true)} onEdit={(template) => { setEditingTemplate(template); setShowCreateTemplate(true); }} onDelete={(template) => setDeleteTemplateModal({ isOpen: true, template })} />
      <CreateTemplateModal isOpen={showCreateTemplate} onClose={() => { setShowCreateTemplate(false); setEditingTemplate(null); }} onSave={handleSaveTemplate} editTemplate={editingTemplate} />
      <DeleteTemplateModal isOpen={deleteTemplateModal.isOpen} template={deleteTemplateModal.template} onConfirm={handleDeleteTemplate} onClose={() => setDeleteTemplateModal({ isOpen: false, template: null })} isDeleting={isDeletingTemplate} />
      <QualityRatingModal isOpen={showQualityModal} onClose={() => { setShowQualityModal(false); setPendingSessionEnd(null); resetSession(); loadData(); }} onSubmit={handleSaveQuality} />
    </div>
  );
}