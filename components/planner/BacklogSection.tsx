'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronRight, X } from 'lucide-react';
import { Task, TaskTag } from '@/lib/types';
import { TAGS, TAG_COLORS } from '@/lib/constants/tags';
import PaginationBar from '@/components/ui/PaginationBar';

const PAGE_SIZE = 20;

interface BacklogSectionProps {
  tasks: Task[];
  milestoneNames: Record<string, string>;
  onToggle: (taskId: string, completed: boolean) => Promise<void>;
  onEditTask: (task: Task) => void;
}

export default function BacklogSection({ tasks, milestoneNames, onToggle, onEditTask }: BacklogSectionProps) {
  const [showBacklog, setShowBacklog] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<TaskTag | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<1 | 2 | 3 | 'all'>('all');
  const [milestoneFilter, setMilestoneFilter] = useState<string | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Reset page when any filter changes
  useEffect(() => { setPage(1); }, [searchQuery, tagFilter, priorityFilter, milestoneFilter, dateFrom, dateTo]);

  const uniqueMilestones = useMemo(() => {
    const ids = [...new Set(tasks.map(t => t.milestone_id).filter(Boolean))];
    return ids
      .map(id => ({ id, name: milestoneNames[id] || `Milestone (${id.slice(0, 6)}...)` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, milestoneNames]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesActivity = task.activity.toLowerCase().includes(q);
        const matchesDescription = task.description?.toLowerCase().includes(q);
        if (!matchesActivity && !matchesDescription) return false;
      }
      if (tagFilter !== 'all' && task.tag !== tagFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (milestoneFilter !== 'all' && task.milestone_id !== milestoneFilter) return false;
      if (dateFrom && task.date < dateFrom) return false;
      if (dateTo && task.date > dateTo) return false;
      return true;
    });
  }, [tasks, searchQuery, tagFilter, priorityFilter, milestoneFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE);
  const paginatedTasks = filteredTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters = searchQuery || tagFilter !== 'all' || priorityFilter !== 'all' || milestoneFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setSearchQuery('');
    setTagFilter('all');
    setPriorityFilter('all');
    setMilestoneFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setShowBacklog(!showBacklog)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition mb-3"
      >
        <ChevronRight className={`w-4 h-4 transition-transform ${showBacklog ? 'rotate-90' : ''}`} />
        Backlog / Upcoming ({tasks.length} total{hasActiveFilters ? `, ${filteredTasks.length} shown` : ''})
      </button>

      {showBacklog && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Filter Bar */}
          <div className="space-y-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              {/* Tag Filter */}
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value as TaskTag | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="all">All Tags</option>
                {TAGS.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>

              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value === 'all' ? 'all' : Number(e.target.value) as 1 | 2 | 3)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="1">P1 — High</option>
                <option value="2">P2 — Medium</option>
                <option value="3">P3 — Low</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {/* Milestone Filter */}
              {uniqueMilestones.length > 0 && (
                <select
                  value={milestoneFilter}
                  onChange={(e) => setMilestoneFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                >
                  <option value="all">All Milestones</option>
                  {uniqueMilestones.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}

              {/* Date Range */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 shrink-0">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
                <label className="text-xs text-gray-500 shrink-0">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-2">
            {paginatedTasks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {tasks.length === 0 ? 'No tasks outside the current date window.' : 'No tasks match your filters.'}
              </p>
            ) : paginatedTasks.map(task => {
              const milestoneName = milestoneNames[task.milestone_id] ?? '';
              return (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Toggle complete */}
                    <button
                      onClick={() => onToggle(task.id, !task.completed)}
                      className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition ${
                        task.completed
                          ? 'bg-lime-500 hover:bg-lime-600'
                          : 'border-2 border-gray-300 hover:border-lime-500'
                      }`}
                    >
                      {task.completed && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full shrink-0 border ${TAG_COLORS[task.tag] || 'bg-sky-100 text-sky-700 border-sky-300'}`}>
                      {task.tag}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">P{task.priority}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.activity}</p>
                      <p className="text-xs text-gray-500">
                        {task.date || 'No date'} {milestoneName && `· ${milestoneName}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(task.actual_cost > 0 || task.revenue > 0) && (
                      <div className="text-xs font-semibold">
                        {task.revenue > 0 && <span className="text-lime-600">+${task.revenue.toFixed(2)}</span>}
                        {task.actual_cost > 0 && <span className="text-red-600 ml-1">-${task.actual_cost.toFixed(2)}</span>}
                      </div>
                    )}
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition"
                      title="Edit / schedule"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <PaginationBar
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            variant="light"
          />
        </div>
      )}
    </div>
  );
}
