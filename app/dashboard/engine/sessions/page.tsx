// app/dashboard/engine/sessions/page.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FocusSession, Task } from '@/lib/types';
import { Plus, Search, Filter, X } from 'lucide-react';
import SessionsTable from './components/SessionsTable';
import SessionDetailPanel from './components/SessionDetailPanel';
import SessionCreateModal from './components/SessionCreateModal';
import SessionEditModal from './components/SessionEditModal';
import DuplicateSessionModal from './components/DuplicateSessionModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import ForceStopModal from './components/ForceStopModal';
import TaskCreateModal from './components/TaskCreateModal';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [selectedSession, setSelectedSession] = useState<FocusSession | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isForceStopModalOpen, setIsForceStopModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const [editingSession, setEditingSession] = useState<FocusSession | null>(null);
  const [duplicatingSession, setDuplicatingSession] = useState<FocusSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<FocusSession | null>(null);
  const [stoppingSession, setStoppingSession] = useState<FocusSession | null>(null);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSessionType, setFilterSessionType] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [sessionsData, tasksData] = await Promise.all([
        supabase
          .from('focus_sessions')
          .select('*')
          .order('start_time', { ascending: false }),
        supabase
          .from('tasks')
          .select('*')
          .order('date', { ascending: false }),
      ]);

      if (sessionsData.error) throw sessionsData.error;
      if (tasksData.error) throw tasksData.error;

      setSessions(sessionsData.data || []);
      setTasks(tasksData.data || []);
    } catch (err) {
      console.error('Load data error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // View session in detail panel
  const handleView = (session: FocusSession) => {
    setSelectedSession(session);
    setIsPanelOpen(true);
  };

  // Edit session
  const handleEdit = (session: FocusSession) => {
    setEditingSession(session);
    setIsEditModalOpen(true);
  };

  // Duplicate session
  const handleDuplicate = (session: FocusSession) => {
    setDuplicatingSession(session);
    setIsDuplicateModalOpen(true);
  };

  // Delete session (show confirmation)
  const handleDelete = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setDeletingSession(session);
      setIsDeleteModalOpen(true);
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deletingSession) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('focus_sessions')
        .delete()
        .eq('id', deletingSession.id);

      if (error) throw error;

      setSessions(sessions.filter(s => s.id !== deletingSession.id));
      
      // Close panel if deleted session was open
      if (selectedSession?.id === deletingSession.id) {
        setIsPanelOpen(false);
        setSelectedSession(null);
      }

      setIsDeleteModalOpen(false);
      setDeletingSession(null);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete session. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Force stop session (show confirmation)
  const handleForceStop = (session: FocusSession) => {
    setStoppingSession(session);
    setIsForceStopModalOpen(true);
  };

  // Confirm force stop
  const handleConfirmForceStop = async () => {
    if (!stoppingSession) return;

    try {
      setIsStopping(true);
      const now = new Date().toISOString();
      const startTime = new Date(stoppingSession.start_time);
      const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);

      const { error } = await supabase
        .from('focus_sessions')
        .update({
          end_time: now,
          duration: duration,
        })
        .eq('id', stoppingSession.id);

      if (error) throw error;

      await loadData();
      setIsForceStopModalOpen(false);
      setStoppingSession(null);
    } catch (err) {
      console.error('Force stop error:', err);
      alert('Failed to stop session. Please try again.');
    } finally {
      setIsStopping(false);
    }
  };

  // Save duplicated session
  const handleSaveDuplicate = async (sessionData: Partial<FocusSession>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('focus_sessions').insert({
        user_id: user.id,
        ...sessionData,
      });

      if (error) throw error;

      await loadData();
    } catch (err) {
      console.error('Duplicate session error:', err);
      throw err;
    }
  };

  // Derive all unique tags from sessions for filter dropdown
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    sessions.forEach(s => s.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [sessions]);

  // Apply filters
  const filteredSessions = useMemo(() => {
    let result = sessions;
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      result = result.filter(s => {
        const task = s.task_id ? tasks.find(t => t.id === s.task_id) : null;
        const text = `${s.notes || ''} ${task?.activity || ''} ${(s.tags || []).join(' ')} ${s.session_type || ''}`.toLowerCase();
        return text.includes(q);
      });
    }

    if (dateFrom) {
      result = result.filter(s => s.start_time >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(s => s.start_time <= dateTo + 'T23:59:59');
    }
    if (filterSessionType) {
      result = result.filter(s => s.session_type === filterSessionType);
    }
    if (filterTag) {
      result = result.filter(s => s.tags?.includes(filterTag));
    }

    return result;
  }, [sessions, tasks, searchQuery, dateFrom, dateTo, filterSessionType, filterTag]);

  const hasActiveFilters = searchQuery || dateFrom || dateTo || filterSessionType || filterTag;

  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setFilterSessionType('');
    setFilterTag('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading sessions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Focus Sessions</h1>
            <p className="text-gray-600">
              View and manage all your focus sessions. Click any row to see details.
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>New Session</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Sessions</div>
            <div className="text-3xl font-bold text-indigo-600">{sessions.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Time</div>
            <div className="text-3xl font-bold text-purple-600">
              {Math.floor(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 3600)}h
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
            <div className="text-3xl font-bold text-lime-600">
              ${sessions.reduce((sum, s) => sum + (s.revenue || 0), 0).toFixed(0)}
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-8 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes, tasks, tags..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm text-gray-800"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                showFilters || hasActiveFilters
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-indigo-600 rounded-full" />
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-xs text-red-600 hover:text-red-800 transition"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={filterSessionType}
                  onChange={(e) => setFilterSessionType(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800"
                >
                  <option value="">All types</option>
                  <option value="focus">Focus</option>
                  <option value="work">Work</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tag</label>
                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800"
                >
                  <option value="">All tags</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <p className="text-xs text-gray-500">
              Showing {filteredSessions.length} of {sessions.length} sessions
            </p>
          )}
        </div>

        {/* Table */}
        <SessionsTable
          sessions={filteredSessions}
          tasks={tasks}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onForceStop={handleForceStop}
        />

        {/* Detail Panel */}
        <SessionDetailPanel
          session={selectedSession}
          tasks={tasks}
          isOpen={isPanelOpen}
          onClose={() => {
            setIsPanelOpen(false);
            setSelectedSession(null);
          }}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />

        {/* Create Modal */}
        <SessionCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={loadData}
          tasks={tasks}
          onOpenTaskModal={() => setIsTaskModalOpen(true)}
          allSessions={sessions}
        />

        {/* Edit Modal */}
        <SessionEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingSession(null);
          }}
          onSave={loadData}
          session={editingSession}
          onOpenTaskModal={() => setIsTaskModalOpen(true)}
          tasks={tasks}
          allSessions={sessions}
        />

        {/* Duplicate Modal */}
        <DuplicateSessionModal
          isOpen={isDuplicateModalOpen}
          onClose={() => {
            setIsDuplicateModalOpen(false);
            setDuplicatingSession(null);
          }}
          session={duplicatingSession}
          tasks={tasks}
          onSave={handleSaveDuplicate}
        />

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeletingSession(null);
          }}
          onConfirm={handleConfirmDelete}
          session={deletingSession}
          isDeleting={isDeleting}
        />

        {/* Force Stop Confirmation Modal */}
        <ForceStopModal
          isOpen={isForceStopModalOpen}
          onClose={() => {
            setIsForceStopModalOpen(false);
            setStoppingSession(null);
          }}
          onConfirm={handleConfirmForceStop}
          session={stoppingSession}
          isStopping={isStopping}
        />

        {/* Task Creation Modal */}
        <TaskCreateModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onTaskCreated={async (taskId) => {
            await loadData();
            setIsTaskModalOpen(false);
            // Auto-select new task in edit/create modals
            if (isEditModalOpen && editingSession) {
              setEditingSession({ ...editingSession, task_id: taskId });
            }
          }}
        />
      </div>
    </div>
  );
}