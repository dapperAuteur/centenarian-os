// File: components/TaskCard.tsx
// Individual task display with completion toggle

import { Task, TaskTag } from '@/lib/types';
import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onToggle: (taskId: string, completed: boolean) => void;
}

const TAG_COLORS: Record<TaskTag, string> = {
  FITNESS: 'bg-lime-500 text-lime-900',
  CREATIVE: 'bg-sky-500 text-sky-900',
  SKILL: 'bg-fuchsia-500 text-fuchsia-900',
  OUTREACH: 'bg-amber-500 text-amber-900',
  LIFESTYLE: 'bg-teal-500 text-teal-900',
  MINDSET: 'bg-indigo-500 text-indigo-900',
  FUEL: 'bg-orange-500 text-orange-900',
};

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const tagColor = TAG_COLORS[task.tag];

  return (
    <div 
      className={`flex flex-col p-4 mb-3 border-l-4 rounded-lg shadow-sm transition-all duration-200 ${
        task.completed 
          ? 'bg-white opacity-70 border-lime-500' 
          : 'bg-white hover:shadow-lg border-sky-500'
      }`}
    >
      <div className="flex items-start">
        <button
          onClick={() => onToggle(task.id, task.completed)}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 mt-1 transition-all duration-200 ${
            task.completed 
              ? 'bg-lime-500 hover:bg-lime-600' 
              : 'bg-white border-2 border-gray-300 hover:border-lime-500'
          }`}
          aria-label={`Mark task ${task.completed ? 'incomplete' : 'complete'}`}
        >
          {task.completed ? (
            <CheckCircle2 className="w-5 h-5 text-white" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
        </button>

        <div className="flex-grow">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${tagColor}`}>
              {task.tag}
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">P{task.priority}</span>
              {task.description && (
                <button 
                  onClick={() => setIsExpanded(!isExpanded)} 
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition duration-150"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
          <p className={`text-lg font-medium mt-1 ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
            {task.activity}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {task.time}
          </p>
        </div>
      </div>
      
      {isExpanded && task.description && (
        <div className="pt-2 mt-2 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Details:</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
        </div>
      )}
    </div>
  );
}