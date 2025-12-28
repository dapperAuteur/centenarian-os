/* eslint-disable @typescript-eslint/no-explicit-any */
// app/dashboard/engine/sessions/components/SessionsTable.tsx
'use client';

import { useState } from 'react';
import { FocusSession, Task } from '@/lib/types';
import { Edit2, Trash2, ChevronUp, ChevronDown, AlertTriangle, StopCircle } from 'lucide-react';
import { formatDuration, formatDate, formatTime24 } from '@/lib/utils/sessionValidation';

interface SessionsTableProps {
  sessions: FocusSession[];
  tasks: Task[];
  onEdit: (session: FocusSession) => void;
  onDelete: (sessionId: string) => void;
  onForceStop: (session: FocusSession) => void;
}

type SortField = 'start_time' | 'duration' | 'task' | 'revenue';
type SortDirection = 'asc' | 'desc';

/**
 * Sortable, filterable table for focus sessions
 * Shows session data with actions (edit/delete/force-stop)
 */
export default function SessionsTable({
  sessions,
  tasks,
  onEdit,
  onDelete,
  onForceStop,
}: SessionsTableProps) {
  const [sortField, setSortField] = useState<SortField>('start_time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'start_time':
        aValue = new Date(a.start_time).getTime();
        bValue = new Date(b.start_time).getTime();
        break;
      case 'duration':
        aValue = a.duration || 0;
        bValue = b.duration || 0;
        break;
      case 'task':
        const aTask = tasks.find(t => t.id === a.task_id);
        const bTask = tasks.find(t => t.id === b.task_id);
        aValue = aTask?.activity || '';
        bValue = bTask?.activity || '';
        break;
      case 'revenue':
        aValue = a.revenue || 0;
        bValue = b.revenue || 0;
        break;
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    }
    return aValue < bValue ? 1 : -1;
  });

  const getTaskName = (taskId: string | null) => {
    if (!taskId) return <span className="text-gray-400 italic">No task</span>;
    const task = tasks.find(t => t.id === taskId);
    return task ? task.activity : <span className="text-gray-400 italic">Deleted task</span>;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUp className="w-4 h-4 text-gray-300" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-indigo-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-indigo-600" />
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('start_time')}
              >
                <div className="flex items-center space-x-1">
                  <span>Date & Time</span>
                  <SortIcon field="start_time" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('duration')}
              >
                <div className="flex items-center space-x-1">
                  <span>Duration</span>
                  <SortIcon field="duration" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('task')}
              >
                <div className="flex items-center space-x-1">
                  <span>Task</span>
                  <SortIcon field="task" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('revenue')}
              >
                <div className="flex items-center space-x-1">
                  <span>Revenue</span>
                  <SortIcon field="revenue" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedSessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No sessions found
                </td>
              </tr>
            ) : (
              sortedSessions.map((session) => {
                const isRunning = !session.end_time;
                
                return (
                  <tr key={session.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDate(session.start_time)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatTime24(session.start_time)}
                        {session.end_time && (
                          <> - {formatTime24(session.end_time)}</>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isRunning ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-lime-100 text-lime-800">
                          Running
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">
                          {formatDuration(session.duration || 0, true)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {getTaskName(session.task_id ?? null)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {session.revenue && session.revenue > 0 ? (
                        <span className="text-sm font-semibold text-lime-600">
                          ${session.revenue.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">$0.00</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {session.notes ? (
                        <div className="text-sm text-gray-600 max-w-xs truncate">
                          {session.notes}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">No notes</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isRunning ? (
                        <button
                          onClick={() => onForceStop(session)}
                          className="flex items-center justify-end space-x-2 text-amber-600 hover:text-amber-900 transition ml-auto"
                          title="Force stop this session"
                        >
                          <StopCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Force Stop</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => onEdit(session)}
                            className="text-indigo-600 hover:text-indigo-900 transition"
                            aria-label="Edit session"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(session.id)}
                            className="text-red-600 hover:text-red-900 transition"
                            aria-label="Delete session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}