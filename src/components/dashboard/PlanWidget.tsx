// centenarian-os/src/components/dashboard/PlanWidget.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useEntryStore } from '@/lib/store';
import { useAuth } from '@/context/auth-context';

/**
 * PlanWidget Component - Displays today's tasks with visual progress tracking
 * 
 * DESIGN PRINCIPLES (from prototype):
 * 1. Color-coded task cards based on tag type
 * 2. Expandable descriptions for detailed task info
 * 3. Visual progress indication (completed tasks get muted styling)
 * 4. Smooth animations for state changes
 * 
 * ACCESSIBILITY:
 * - Keyboard navigation supported via Checkbox component
 * - ARIA labels for expand/collapse buttons
 * - Semantic HTML structure
 */

type TaskTag = 'FITNESS' | 'CREATIVE' | 'SKILL' | 'OUTREACH' | 'LIFESTYLE' | 'MINDSET' | 'FUEL';

interface Task {
  id: string;
  content: string;
  completed?: boolean;
  type?: 'task' | 'note';
  tag?: TaskTag;
  description?: string;
  priority?: number;
  time?: string;
  createdAt?: Date;
}

/**
 * Returns Tailwind classes for task badges based on tag type
 * Follows Strategic Color Palette from style guide
 */
const getTagColor = (tag: TaskTag): string => {
  const tagColors: Record<TaskTag, string> = {
    FITNESS: 'bg-lime-500 text-white border-lime-300',
    CREATIVE: 'bg-sky-500 text-white border-sky-300',
    SKILL: 'bg-fuchsia-500 text-white border-fuchsia-300',
    OUTREACH: 'bg-amber-500 text-white border-amber-300',
    LIFESTYLE: 'bg-teal-500 text-white border-teal-300',
    MINDSET: 'bg-indigo-500 text-white border-indigo-300',
    FUEL: 'bg-orange-500 text-white border-orange-300',
  };
  return tagColors[tag] || 'bg-gray-400 text-white border-gray-300';
};

/**
 * Individual Task Card Component
 * Matches the visual design from CentenarianJourneyDashboard.tsx prototype
 */
const TaskCard = ({ 
  task, 
  onToggle 
}: { 
  task: Task; 
  onToggle: (id: string, completed: boolean) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const tag = task.tag || 'MINDSET';
  const hasDescription = task.description && task.description.length > 0;
  const badgeColor = getTagColor(tag);
  
  return (
    <div
      className={`flex flex-col p-4 mb-3 border-l-4 rounded-lg shadow-sm transition-all duration-200 
        ${task.completed 
          ? 'bg-lime-50 border-lime-500 opacity-70' 
          : 'bg-white hover:shadow-lg border-sky-500'
        }
      `}
    >
      {/* Main Task Row */}
      <div className="flex items-start">
        {/* Completion Checkbox */}
        <button
          onClick={() => onToggle(task.id, task.completed || false)}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 mt-1 transition-colors duration-200 transform hover:scale-105 
            ${task.completed 
              ? 'bg-lime-500 hover:bg-lime-600' 
              : 'bg-white border-2 border-gray-300 hover:border-lime-500'
            }
          `}
          aria-label={`Mark task ${task.completed ? 'incomplete' : 'complete'}`}
        >
          {task.completed && (
            <svg 
              className="w-5 h-5 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="3" 
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
        
        {/* Task Content */}
        <div className="flex-grow">
          <div className="flex items-center justify-between">
            {/* Tag Badge */}
            <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeColor}`}>
              {tag}
            </span>
            
            {/* Right Side Meta */}
            <div className="flex items-center space-x-2">
              {task.priority && (
                <span className="text-xs text-gray-400">P{task.priority}</span>
              )}
              
              {/* Expand/Collapse Button (only show if there's a description) */}
              {hasDescription && (
                <button 
                  onClick={() => setIsExpanded(!isExpanded)} 
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition duration-150"
                  aria-expanded={isExpanded}
                  aria-controls={`task-detail-${task.id}`}
                  aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                >
                  <svg 
                    className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* Task Title */}
          <p className={`text-lg font-medium mt-1 ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
            {task.content}
          </p>
          
          {/* Time (if available) */}
          {task.time && (
            <p className="text-sm text-gray-500 mt-0.5 flex items-center">
              <svg 
                className="w-4 h-4 mr-1.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {task.time}
            </p>
          )}
        </div>
      </div>
      
      {/* Expandable Description Section */}
      {hasDescription && (
        <div 
          id={`task-detail-${task.id}`}
          className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100 pt-3' : 'max-h-0 opacity-0'}`}
        >
          <div className="pt-2 mt-2 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Details:</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Main PlanWidget Component
 */
export function PlanWidget() {
  const { user } = useAuth();
  const entries = useEntryStore((state) => state.entries);
  const updateEntry = useEntryStore((state) => state.updateEntry);
  
  // Filter and sort tasks
  const tasks: Task[] = useMemo(() => {
    return entries
      .filter(entry => entry.type === 'task')
      .sort((a, b) => {
        // Sort by completion status first (incomplete tasks first)
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        // Then by priority (if available)
        const priorityA = (a as Task).priority || 999;
        const priorityB = (b as Task).priority || 999;
        return priorityA - priorityB;
      }) as Task[];
  }, [entries]);
  
  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.completed).length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  const handleToggle = (id: string, completed: boolean) => {
    if (user) {
      updateEntry(id, { completed: !completed }, user.uid);
    }
  };

  return (
    <Card className="bg-white rounded-2xl shadow-xl border-t-4 border-sky-500 h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Today&apos;s Plan
            </CardTitle>
            <CardDescription className="text-gray-500">
              Focus on high-priority items first.
            </CardDescription>
          </div>
          
          {/* Progress Circle (Mini) */}
          {tasks.length > 0 && (
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{progressPercentage}%</p>
                <p className="text-xs text-gray-500">Complete</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Progress Bar */}
        {tasks.length > 0 && (
          <div className="mt-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-lime-500 transition-all duration-700 ease-out" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={handleToggle}
              />
            ))
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <svg 
                className="w-12 h-12 mx-auto text-gray-300 mb-3" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-sm text-gray-500 font-medium">
                No tasks scheduled for today.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Add a task using the &quot;New Entry&quot; button above.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}