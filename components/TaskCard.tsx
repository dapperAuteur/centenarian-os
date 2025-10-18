'use client';

import { useState } from 'react';
import { Task } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  onToggle: (taskId: string, completed: boolean) => Promise<void>;
  onEdit: (task: Task) => void;
}

export function TaskCard({ task, onToggle, onEdit }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`p-4 rounded-lg border-l-4 transition ${
      task.completed 
        ? 'bg-gray-50 border-lime-500 opacity-70' 
        : 'bg-white border-sky-500 hover:shadow-md'
    }`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(task.id, !task.completed)}
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition mt-1 ${
            task.completed 
              ? 'bg-lime-500 hover:bg-lime-600' 
              : 'border-2 border-gray-300 hover:border-lime-500'
          }`}
        >
          {task.completed && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-grow">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold uppercase px-2 py-1 rounded-full ${
                task.completed ? 'bg-gray-300 text-gray-600' : 'bg-sky-500 text-white'
              }`}>
                {task.tag}
              </span>
              <span className="text-xs text-gray-500">P{task.priority}</span>
            </div>
            <div className="flex items-center gap-2">
              {(task.actual_cost > 0 || task.revenue > 0) && (
                <div className="text-xs font-semibold">
                  {task.revenue > 0 && <span className="text-lime-600">+${task.revenue.toFixed(2)}</span>}
                  {task.actual_cost > 0 && <span className="text-red-600 ml-1">-${task.actual_cost.toFixed(2)}</span>}
                </div>
              )}
              <button
                onClick={() => onEdit(task)}
                className="p-1 hover:bg-gray-100 rounded transition"
                aria-label="Edit task"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-gray-100 rounded transition"
                aria-label="Toggle details"
              >
                <svg className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          <p className={`text-lg font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
            {task.activity}
          </p>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {task.time}
          </p>

          {isExpanded && task.description && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}