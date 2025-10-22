// app/dashboard/engine/sessions/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FocusSession, Task } from '@/lib/types';
import { Plus, Search, Filter, RefreshCw } from 'lucide-react';
import SessionsTable from './components/SessionsTable';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import ForceStopModal from './components/ForceStopModal';


const SESSIONS_PER_PAGE = 50;

interface Filters {
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  taskId: string;
  minRevenue: string;
  maxDuration: string;
  minDuration: string;
}

/**
 * Focus Sessions Management Page
 * View, filter, search, and manage all focus sessions
 */
export default function SessionsPage() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [allSessions, setAllSessions] = useState<FocusSession[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; session: FocusSession | null }>({
    isOpen: false,
    session: null,
  });
  const [forceStopModal, setForceStopModal] = useState<{ isOpen: boolean; session: FocusSession | null }>({
    isOpen: false,
    session: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    searchQuery: '',
    dateFrom: '',
    dateTo: '',
    taskId: '',
    minRevenue: '',
    maxDuration: '',
    minDuration: '',
  });

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Load all sessions (RLS handles user filtering automatically)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('focus_sessions')
        .select('*')
        .order('start_time', { ascending: false });
      if (sessionsError) {
        console.error('Sessions error:', sessionsError);
        throw sessionsError;
      }
      // Load tasks (RLS handles user filtering through milestone->goal->roadmap hierarchy)
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('date', { ascending: false })
        .limit(500); // Reasonable limit to prevent loading thousands
      if (tasksError) {
        console.error('Tasks error:', tasksError);
        throw tasksError;
      }

      setAllSessions(sessionsData || []);
      setSessions(sessionsData || []);
      setTasks(tasksData || []);
    } catch (err) {
      console.error('Load data error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Apply filters
  useEffect(() => {
    let filtered = [...allSessions];

    // Search filter (task name, notes)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(session => {
        const task = tasks.find(t => t.id === session.task_id);
        const taskName = task?.activity?.toLowerCase() || '';
        const notes = session.notes?.toLowerCase() || '';
        const revenue = session.revenue?.toString() || '';
        const rate = session.hourly_rate?.toString() || '';
        
        return (
          taskName.includes(query) ||
          notes.includes(query) ||
          revenue.includes(query) ||
          rate.includes(query)
        );
      });
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom).getTime();
      filtered = filtered.filter(
        session => new Date(session.start_time).getTime() >= fromDate
      );
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo + 'T23:59:59').getTime();
      filtered = filtered.filter(
        session => new Date(session.start_time).getTime() <= toDate
      );
    }

    // Task filter
    if (filters.taskId) {
      filtered = filtered.filter(session => session.task_id === filters.taskId);
    }

    // Revenue filter
    if (filters.minRevenue) {
      const minRev = parseFloat(filters.minRevenue);
      filtered = filtered.filter(
        session => (session.revenue || 0) >= minRev
      );
    }

    // Duration filters
    if (filters.minDuration) {
      const minDur = parseInt(filters.minDuration) * 60; // Convert minutes to seconds
      filtered = filtered.filter(
        session => (session.duration || 0) >= minDur
      );
    }

    if (filters.maxDuration) {
      const maxDur = parseInt(filters.maxDuration) * 60; // Convert minutes to seconds
      filtered = filtered.filter(
        session => (session.duration || 0) <= maxDur
      );
    }

    setSessions(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [filters, allSessions, tasks]);

  // Pagination
  const totalPages = Math.ceil(sessions.length / SESSIONS_PER_PAGE);
  const paginatedSessions = sessions.slice(
    (currentPage - 1) * SESSIONS_PER_PAGE,
    currentPage * SESSIONS_PER_PAGE
  );

  const handleEdit = (session: FocusSession) => {
    // TODO: Phase 3 - Open edit modal
    console.log('Edit session:', session.id);
  };

  const handleDeleteClick = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setDeleteModal({ isOpen: true, session });
    }
  };
  const handleDeleteConfirm = async () => {
    if (!deleteModal.session) return;
    try {
      setIsDeleting(true);
      setError(null);
      const { error: deleteError } = await supabase
        .from('focus_sessions')
        .delete()
        .eq('id', deleteModal.session.id);
      if (deleteError) throw deleteError;
      setSuccess('Session deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      
      setDeleteModal({ isOpen: false, session: null });
      await loadData();
    } catch (err) {
      console.error('Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    } finally {
      setIsDeleting(false);
    }
  };
  const handleForceStopClick = (session: FocusSession) => {
    setForceStopModal({ isOpen: true, session });
  };
  const handleForceStopConfirm = async () => {
    if (!forceStopModal.session) return;
    try {
      setIsStopping(true);
      setError(null);
      const endTime = new Date().toISOString();
      const duration = Math.floor(
        (new Date(endTime).getTime() - new Date(forceStopModal.session.start_time).getTime()) / 1000
      );
      const revenue = (duration / 3600) * (forceStopModal.session.hourly_rate || 0);
      const { error: updateError } = await supabase
        .from('focus_sessions')
        .update({
          end_time: endTime,
          duration: duration,
          revenue: revenue,
        })
        .eq('id', forceStopModal.session.id);
      if (updateError) throw updateError;
      setSuccess('Session force-stopped successfully');
      setTimeout(() => setSuccess(null), 3000);
      
      setForceStopModal({ isOpen: false, session: null });
      await loadData();
    } catch (err) {
      console.error('Force stop error:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop session');
    } finally {
      setIsStopping(false);
    }
  };

  const handleCreateNew = () => {
    // TODO: Phase 4 - Open create modal
    console.log('Create new session');
  };

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      dateFrom: '',
      dateTo: '',
      taskId: '',
      minRevenue: '',
      maxDuration: '',
      minDuration: '',
    });
  };

  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalRevenue = sessions.reduce((sum, s) => sum + (s.revenue || 0), 0);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading sessions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Focus Sessions</h1>
            <p className="text-gray-600">
              Showing {paginatedSessions.length} of {sessions.length} sessions
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadData}
              className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={handleCreateNew}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Session
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      {success && (
        <div className="mb-6 p-4 bg-lime-50 border border-lime-200 rounded-lg">
          <p className="text-sm text-lime-700">{success}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-500 mb-1">Total Sessions</div>
          <div className="text-3xl font-bold text-gray-900">{sessions.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-500 mb-1">Total Time</div>
          <div className="text-3xl font-bold text-indigo-600">
            {Math.floor(totalDuration / 3600)}h {Math.floor((totalDuration % 3600) / 60)}m
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-lime-600">
            ${totalRevenue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              placeholder="Search by task, notes, rate, or revenue..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
            />
          </div>

          {/* Toggle Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-4 py-2 border rounded-lg transition ${
              showFilters
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
                />
              </div>

              {/* Task Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task
                </label>
                <select
                  value={filters.taskId}
                  onChange={(e) => setFilters({ ...filters, taskId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
                >
                  <option value="">All tasks</option>
                  {tasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.activity}
                    </option>
                  ))}
                </select>
              </div>

              {/* Min Revenue */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Revenue ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={filters.minRevenue}
                  onChange={(e) => setFilters({ ...filters, minRevenue: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
                />
              </div>

              {/* Min Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Duration (min)
                </label>
                <input
                  type="number"
                  value={filters.minDuration}
                  onChange={(e) => setFilters({ ...filters, minDuration: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
                />
              </div>

              {/* Max Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Duration (min)
                </label>
                <input
                  type="number"
                  value={filters.maxDuration}
                  onChange={(e) => setFilters({ ...filters, maxDuration: e.target.value })}
                  placeholder="720"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <SessionsTable
        sessions={paginatedSessions}
        tasks={tasks}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onForceStop={handleForceStopClick}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {/* Modals */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, session: null })}
        onConfirm={handleDeleteConfirm}
        session={deleteModal.session}
        isDeleting={isDeleting}
      />
      <ForceStopModal
        isOpen={forceStopModal.isOpen}
        onClose={() => setForceStopModal({ isOpen: false, session: null })}
        onConfirm={handleForceStopConfirm}
        session={forceStopModal.session}
        isStopping={isStopping}
      />
    </div>
  );
}