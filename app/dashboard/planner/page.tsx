// File: app/dashboard/planner/page.tsx
// Main task view with day/week toggle

'use client';

import { useTasks } from '@/lib/hooks/useTasks';
import { TaskCard } from '@/components/TaskCard';
import { useState, useMemo } from 'react';
import { Task } from '@/lib/types';

type ViewMode = 'day' | 'week';

export default function PlannerPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const today = new Date();
  
  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    
    if (viewMode === 'week') {
      // Get Monday of current week
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      
      // Get Sunday
      end.setDate(start.getDate() + 6);
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }, [viewMode]);

  const { tasks, loading, error, toggleComplete } = useTasks(startDate, endDate);

  // Group tasks by day
  const tasksByDay = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    tasks.forEach(task => {
      if (!grouped[task.date]) {
        grouped[task.date] = [];
      }
      grouped[task.date].push(task);
    });
    return grouped;
  }, [tasks]);

  // Calculate progress
  const progress = useMemo(() => {
    const completed = tasks.filter(t => t.completed).length;
    return tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  }, [tasks]);

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-100 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">The Planner</h1>
        <p className="text-gray-600">Connect daily tasks to long-term goals</p>
      </header>

      {/* Progress Bar */}
      <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {viewMode === 'day' ? 'Today' : 'This Week'} Progress
          </span>
          <span className="text-2xl font-bold text-gray-900">{progress}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-lime-500 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {tasks.filter(t => t.completed).length} of {tasks.length} tasks complete
        </p>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode('day')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            viewMode === 'day' 
              ? 'bg-sky-600 text-white shadow-md' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setViewMode('week')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            viewMode === 'week' 
              ? 'bg-sky-600 text-white shadow-md' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          This Week
        </button>
      </div>

      {/* Tasks */}
      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-3">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <p className="text-gray-500 text-lg">No tasks scheduled for {viewMode === 'day' ? 'today' : 'this week'}.</p>
          <p className="text-gray-400 text-sm mt-2">Create your first milestone and task to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(tasksByDay)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, dayTasks]) => {
              const dateObj = new Date(date + 'T00:00:00');
              const dayProgress = Math.round(
                (dayTasks.filter(t => t.completed).length / dayTasks.length) * 100
              );

              return (
                <div key={date} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="p-5 border-b border-gray-100 bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800">
                          {dateObj.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </h2>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{dayProgress}%</div>
                        <div className="text-xs text-gray-500">
                          {dayTasks.filter(t => t.completed).length}/{dayTasks.length}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {dayTasks
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((task) => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          onToggle={toggleComplete} 
                        />
                      ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}