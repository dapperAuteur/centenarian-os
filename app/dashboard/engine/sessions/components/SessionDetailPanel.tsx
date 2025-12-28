// app/dashboard/engine/sessions/components/SessionDetailPanel.tsx
'use client';

import { useState } from 'react';
import { FocusSession, Task } from '@/lib/types';
import { X, Edit2, Trash2, Copy, Clock, DollarSign, Calendar, Tag, FileText } from 'lucide-react';
import { formatDuration, formatDate, formatTime24 } from '@/lib/utils/sessionValidation';

interface SessionDetailPanelProps {
  session: FocusSession | null;
  tasks: Task[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (session: FocusSession) => void;
  onDelete: (sessionId: string) => void;
  onDuplicate: (session: FocusSession) => void;
}

/**
 * Side panel for viewing session details with edit/delete/duplicate actions
 * Slides in from right, displays all session data in organized sections
 */
export default function SessionDetailPanel({
  session,
  tasks,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
}: SessionDetailPanelProps) {
  if (!session) return null;

  const task = session.task_id ? tasks.find(t => t.id === session.task_id) : null;
  const isRunning = !session.end_time;

  const handleDelete = () => {
    if (confirm('Delete this session? This cannot be undone.')) {
      onDelete(session.id);
      onClose();
    }
  };

  const handleDuplicate = () => {
    onDuplicate(session);
    onClose();
  };

  return (
    <>
      {/* Backdrop - mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Session Details</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
            aria-label="Close panel"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-180px)] p-6 space-y-6">
          {/* Status Badge */}
          {isRunning && (
            <div className="p-3 bg-lime-50 border border-lime-200 rounded-lg">
              <p className="text-sm font-semibold text-lime-800 flex items-center space-x-2">
                <span className="w-2 h-2 bg-lime-600 rounded-full animate-pulse" />
                <span>Session is currently running</span>
              </p>
            </div>
          )}

          {/* Date & Time */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-gray-700">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold">Date & Time</h3>
            </div>
            <div className="pl-7 space-y-1">
              <p className="text-sm text-gray-900 font-medium">
                {formatDate(session.start_time)}
              </p>
              <p className="text-sm text-gray-600">
                Started: {formatTime24(session.start_time)}
              </p>
              {session.end_time && (
                <p className="text-sm text-gray-600">
                  Ended: {formatTime24(session.end_time)}
                </p>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-gray-700">
              <Clock className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold">Duration</h3>
            </div>
            <div className="pl-7">
              <p className="text-2xl font-bold text-gray-900">
                {isRunning ? 'Running...' : formatDuration(session.duration || 0, true)}
              </p>
              {session.duration && session.duration > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {session.duration} seconds total
                </p>
              )}
            </div>
          </div>

          {/* Task */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-gray-700">
              <Tag className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold">Task</h3>
            </div>
            <div className="pl-7">
              {task ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">{task.activity}</p>
                  {task.description && (
                    <p className="text-xs text-gray-600">{task.description}</p>
                  )}
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>Tag: {task.tag}</span>
                    <span>Priority: {task.priority || 'None'}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No task assigned</p>
              )}
            </div>
          </div>

          {/* Revenue */}
          {session.revenue !== null && session.revenue !== undefined && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-gray-700">
                <DollarSign className="w-5 h-5 text-lime-600" />
                <h3 className="font-semibold">Revenue</h3>
              </div>
              <div className="pl-7">
                <p className="text-2xl font-bold text-lime-600">
                  ${session.revenue.toFixed(2)}
                </p>
                {session.duration && session.duration > 0 && session.revenue > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    ${((session.revenue / session.duration) * 3600).toFixed(2)}/hour
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pomodoro Info */}
          {session.pomodoro_mode && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-gray-700">
                <span className="text-lg">🍅</span>
                <h3 className="font-semibold">Pomodoro Session</h3>
              </div>
              <div className="pl-7 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Pomodoros</p>
                    <p className="font-semibold text-gray-900">
                      {session.completed_pomodoros ?? session.work_intervals?.length ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Breaks</p>
                    <p className="font-semibold text-gray-900">
                      {session.completed_breaks ?? session.break_intervals?.length ?? 0}
                    </p>
                  </div>
                </div>
                {session.net_work_duration !== null && (
                  <div>
                    <p className="text-gray-600 text-sm">Net Work Time</p>
                    <p className="font-semibold text-gray-900">
                      {formatDuration(session.net_work_duration, true)}
                    </p>
                  </div>
                )}
                {session.quality_rating !== null && (
                  <div>
                    <p className="text-gray-600 text-sm">Quality Rating</p>
                    <div className="flex items-center space-x-1 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-lg ${
                            star <= (session.quality_rating || 0)
                              ? 'text-amber-400'
                              : 'text-gray-300'
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-gray-700">
              <FileText className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold">Notes</h3>
            </div>
            <div className="pl-7">
              {session.notes ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {session.notes}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">No notes added</p>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Created: {new Date(session.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between space-x-3">
            <button
              onClick={() => {
                onEdit(session);
                onClose();
              }}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </button>
            
            <button
              onClick={handleDuplicate}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
            >
              <Copy className="w-4 h-4" />
              <span>Duplicate</span>
            </button>
            
            <button
              onClick={handleDelete}
              className="flex items-center justify-center px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              aria-label="Delete session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}