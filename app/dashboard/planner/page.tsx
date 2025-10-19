'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task } from '@/lib/types';
import { Calendar, Filter, DollarSign } from 'lucide-react';
import { EditTaskModal } from '@/components/EditTaskModal';

type ViewMode = 'day' | 'week' | 'month';

interface TaskCardProps {
  task: Task;
  onToggle: (taskId: string, completed: boolean) => Promise<void>;
  onEdit: (task: Task) => void;
}

function TaskCard({ task, onToggle, onEdit }: TaskCardProps) {
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
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-gray-100 rounded transition"
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

export default function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const supabase = createClient();

  const loadTasks = useCallback(async () => {
    let startDate = selectedDate;
    let endDate = selectedDate;

    if (viewMode === 'week') {
      const date = new Date(selectedDate);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(date.setDate(diff)).toISOString().split('T')[0];
      endDate = new Date(date.setDate(date.getDate() + 6)).toISOString().split('T')[0];
    } else if (viewMode === 'month') {
      const date = new Date(selectedDate);
      startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    const { data } = await supabase
      .from('tasks')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('time');

    if (data) setTasks(data);
    setLoading(false);
  }, [supabase, selectedDate, viewMode]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleToggle = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from('tasks')
      .update({ 
        completed,
        completed_at: completed ? new Date().toISOString() : null 
      })
      .eq('id', taskId);

    if (!error) loadTasks();
  };

  const financialSummary = useMemo(() => {
    return tasks.reduce((acc, task) => ({
      estimatedCost: acc.estimatedCost + (task.estimated_cost || 0),
      actualCost: acc.actualCost + (task.actual_cost || 0),
      revenue: acc.revenue + (task.revenue || 0),
      netProfit: acc.netProfit + ((task.revenue || 0) - (task.actual_cost || 0)),
    }), { estimatedCost: 0, actualCost: 0, revenue: 0, netProfit: 0 });
  }, [tasks]);

  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    tasks.forEach(task => {
      if (!grouped[task.date]) grouped[task.date] = [];
      grouped[task.date].push(task);
    });
    return grouped;
  }, [tasks]);

  const completionStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [tasks]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Task Planner</h1>
        <p className="text-gray-600">Manage your daily execution</p>
      </header>

      {/* View Controls */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg font-medium transition capitalize ${
                viewMode === mode
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
          />
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-gradient-to-r from-lime-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <DollarSign className="w-6 h-6 mr-2" />
          Financial Summary ({viewMode})
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold">${financialSummary.estimatedCost.toFixed(2)}</div>
            <div className="text-sm opacity-90">Estimated Cost</div>
          </div>
          <div>
            <div className="text-2xl font-bold">${financialSummary.actualCost.toFixed(2)}</div>
            <div className="text-sm opacity-90">Actual Cost</div>
          </div>
          <div>
            <div className="text-2xl font-bold">${financialSummary.revenue.toFixed(2)}</div>
            <div className="text-sm opacity-90">Revenue</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${financialSummary.netProfit >= 0 ? 'text-lime-100' : 'text-red-200'}`}>
              ${financialSummary.netProfit.toFixed(2)}
            </div>
            <div className="text-sm opacity-90">Net Profit</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Progress</h3>
          <span className="text-sm text-gray-600">
            {completionStats.completed} / {completionStats.total} tasks
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-lime-500 transition-all duration-500"
            style={{ width: `${completionStats.percentage}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">📅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No tasks found</h2>
          <p className="text-gray-600">Create tasks in your Roadmap to see them here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(tasksByDate).map(([date, dateTasks]) => (
            <div key={date} className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </h3>
              <div className="space-y-3">
                {dateTasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onToggle={handleToggle}
                    onEdit={setEditingTask}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <EditTaskModal
        task={editingTask!}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={loadTasks}
      />
    </div>
  );
}