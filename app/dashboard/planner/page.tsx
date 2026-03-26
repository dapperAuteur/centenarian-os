// app/dashboard/planner/page.tsx
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Task, RecurringTask } from '@/lib/types';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import Link from 'next/link';
import { Calendar, DollarSign, Plus, Repeat, Upload, Download, Filter, Plane, MapPin, Briefcase, CalendarClock, Pencil, Trash2 } from 'lucide-react';
import { EditTaskModal } from '@/components/EditTaskModal';
import CreateRecurringTaskModal, { RecurringTaskData } from '@/components/planner/CreateRecurringTaskModal';
import CreateTaskModal from '@/components/planner/CreateTaskModal';
import BacklogSection from '@/components/planner/BacklogSection';
import TaskCompletionActionsModal from '@/components/planner/TaskCompletionActionsModal';
import WorkJobBlock, { WorkJob } from '@/components/planner/WorkJobBlock';
import SyncedTaskBadge from '@/components/planner/SyncedTaskBadge';
import OutstandingInvoicesWidget from '@/components/planner/OutstandingInvoicesWidget';
import ExpectedPaymentsWidget from '@/components/planner/ExpectedPaymentsWidget';
import type { ExpectedPayment } from '@/lib/types';
import ScheduleTemplateModal, { ScheduleTemplateFormData } from '@/components/planner/ScheduleTemplateModal';
import WorkDayModal, { ConfirmDayData, DayOffData } from '@/components/planner/WorkDayModal';
import PayPeriodCard from '@/components/planner/PayPeriodCard';
import PaycheckReconcileModal, { ReconcileSaveData } from '@/components/planner/PaycheckReconcileModal';
import { getScheduleIndicators } from '@/components/planner/ScheduleCalendarOverlay';
import type { ScheduleTemplate, ScheduleException, SchedulePayPeriod, ScheduleTemplateFinance } from '@/lib/types';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { OfflineSyncManager } from '@/lib/offline/sync-manager';

type ViewMode = 'day' | 'week' | 'month';
type SourceFilter = 'all' | 'calendar' | 'manual' | 'recurring' | 'work' | 'schedule';

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
        : task.source_type === 'expected_payment'
          ? 'bg-emerald-50/50 border-emerald-500 hover:shadow-md'
          : task.source_type
            ? 'bg-amber-50/50 border-amber-500 hover:shadow-md'
            : 'bg-white border-sky-500 hover:shadow-md'
    }`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(task.id, !task.completed)}
          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition mt-1 ${
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
                task.completed ? 'bg-gray-300 text-gray-600' : task.source_type === 'expected_payment' ? 'bg-emerald-500 text-white' : task.source_type ? 'bg-amber-500 text-white' : 'bg-sky-500 text-white'
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
          {task.source_type && (
            <div className="mt-1">
              <SyncedTaskBadge sourceType={task.source_type} sourceId={task.source_id} />
            </div>
          )}
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
  useTrackPageView('planner', '/dashboard/planner');
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const v = searchParams.get('view');
    if (v === 'day' || v === 'week' || v === 'month') return v;
    return 'day';
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = searchParams.get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return new Date().toISOString().split('T')[0];
  });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(() => {
    const f = searchParams.get('filter');
    if (f === 'work') return 'work';
    return 'all';
  });

  // Backlog tasks (outside current date window, not completed)
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);

  // Planned trips
  interface PlannedTrip {
    id: string;
    mode: string;
    date: string;
    end_date: string | null;
    origin: string | null;
    destination: string | null;
    purpose: string | null;
    cost: number | null;
    notes: string | null;
    trip_status: string;
    packing_notes: string | null;
    is_round_trip: boolean;
    vehicles: { id: string; nickname: string; type: string } | null;
  }
  const [plannedTrips, setPlannedTrips] = useState<PlannedTrip[]>([]);

  // Work feed (Work.WitUS integration)
  interface WorkFeedData {
    jobs: WorkJob[];
    assigned_jobs: WorkJob[];
    outstanding_invoices: { id: string; invoice_number: string; contact_name: string; direction: string; status: string; total: number; amount_paid: number; due_date: string; job_id: string | null }[];
    expected_payments: ExpectedPayment[];
    summary: { upcoming_job_count: number; outstanding_receivable_total: number; outstanding_receivable_count: number; overdue_count: number; expected_payments_total: number; expected_payments_count: number };
  }
  const [workFeed, setWorkFeed] = useState<WorkFeedData | null>(null);

  // Recurring task state
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);

  // Create task state
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Completion actions state
  const [completedTask, setCompletedTask] = useState<Task | null>(null);

  // Schedule state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleTemplate | null>(null);
  const [scheduleTemplates, setScheduleTemplates] = useState<ScheduleTemplate[]>([]);
  const [scheduleExceptions, setScheduleExceptions] = useState<ScheduleException[]>([]);
  const [schedulePayPeriods, setSchedulePayPeriods] = useState<SchedulePayPeriod[]>([]);
  const [workDayTarget, setWorkDayTarget] = useState<{
    templateId: string; date: string; name: string;
    taskId?: string; taskCompleted?: boolean;
    finance?: ScheduleTemplateFinance;
  } | null>(null);
  const [paycheckTarget, setPaycheckTarget] = useState<{
    templateId: string; payPeriodId: string; scheduleName: string;
    periodStart: string; periodEnd: string;
    finance?: ScheduleTemplateFinance;
    daysWorked?: number;
    estimatedGross?: number; estimatedNet?: number;
  } | null>(null);
  const [scheduleAccounts, setScheduleAccounts] = useState<{ id: string; name: string }[]>([]);
  const [scheduleCategories, setScheduleCategories] = useState<{ id: string; name: string }[]>([]);

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

    const cacheKey = `supabase://tasks?start=${startDate}&end=${endDate}`;
    const manager = OfflineSyncManager.getInstance();

    try {
      const [mainRes, backlogRes, tripsRes, workFeedRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date')
          .order('time'),
        // Backlog: all active, incomplete tasks outside the current date window
        supabase
          .from('tasks')
          .select('*')
          .eq('completed', false)
          .neq('status', 'archived')
          .or(`date.gt.${endDate},date.lt.${startDate}`)
          .order('date', { ascending: true }),
        // Planned trips overlapping this date range
        offlineFetch(`/api/travel/trips/planned?from=${startDate}&to=${endDate}`),
        // Work.WitUS jobs and outstanding invoices
        offlineFetch(`/api/planner/work-feed?from=${startDate}&to=${endDate}`).catch(() => null),
      ]);

      if (mainRes.data) {
        setTasks(mainRes.data as Task[]);
        await manager.cacheResponse(cacheKey, mainRes.data);
      }
      if (backlogRes.error) {
        console.error('[Planner] Backlog query error:', backlogRes.error);
      }
      setBacklogTasks((backlogRes.data || []) as Task[]);

      if (tripsRes.ok) {
        const tripsData = await tripsRes.json();
        setPlannedTrips(tripsData.trips || []);
      }

      // Work feed (graceful — empty if API fails or no Work.WitUS data)
      if (workFeedRes?.ok) {
        const wfData = await workFeedRes.json();
        setWorkFeed(wfData);
      } else {
        setWorkFeed(null);
      }
    } catch {
      // Offline or error — fall back to cache
      const cached = await manager.getCached<Task[]>(cacheKey);
      if (cached) setTasks(cached);
    }
    setLoading(false);
  }, [supabase, selectedDate, viewMode]);

  const loadRecurringTasks = async () => {
    try {
      const response = await offlineFetch('/api/recurring-tasks');
      if (response.ok) {
        const data = await response.json();
        setRecurringTasks(data);
      }
    } catch (error) {
      console.error('[Planner] Failed to load recurring tasks:', error);
    }
  };

  const loadSchedules = useCallback(async () => {
    try {
      const [templatesRes, accountsRes, categoriesRes] = await Promise.all([
        offlineFetch('/api/schedules'),
        offlineFetch('/api/finance/accounts').catch(() => null),
        offlineFetch('/api/finance/categories').catch(() => null),
      ]);

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setScheduleTemplates(data);

        // Load exceptions for active templates in visible date range
        const activeIds = data.filter((t: ScheduleTemplate) => t.is_active).map((t: ScheduleTemplate) => t.id);
        if (activeIds.length > 0) {
          const allExceptions: ScheduleException[] = [];
          for (const tid of activeIds) {
            const exRes = await offlineFetch(`/api/schedules/${tid}/exceptions`);
            if (exRes.ok) {
              const exData = await exRes.json();
              allExceptions.push(...exData);
            }
          }
          setScheduleExceptions(allExceptions);

          // Load recent pay periods for work templates
          const workTemplates = data.filter((t: ScheduleTemplate) => t.template_type === 'work');
          const allPeriods: SchedulePayPeriod[] = [];
          for (const wt of workTemplates) {
            const ppRes = await offlineFetch(`/api/schedules/${wt.id}/pay-periods`);
            if (ppRes.ok) {
              const ppData = await ppRes.json();
              allPeriods.push(...ppData);
            }
          }
          setSchedulePayPeriods(allPeriods);
        }
      }

      if (accountsRes?.ok) {
        const acData = await accountsRes.json();
        setScheduleAccounts((acData.accounts || acData).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
      }
      if (categoriesRes?.ok) {
        const catData = await categoriesRes.json();
        setScheduleCategories((catData.categories || catData).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } catch (error) {
      console.error('[Planner] Failed to load schedules:', error);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadRecurringTasks();
    loadSchedules();
  }, [loadTasks, loadSchedules]);

  const handleToggle = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from('tasks')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null
      })
      .eq('id', taskId);

    if (!error) {
      await loadTasks();
      // Show completion actions only when marking complete
      if (completed) {
        const task = tasks.find(t => t.id === taskId);
        if (task) setCompletedTask({ ...task, completed: true });
      }
    }
  };

  const handleSaveRecurringTask = async (data: RecurringTaskData) => {
    try {
      const response = await offlineFetch('/api/recurring-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        await loadRecurringTasks();

        // Generate tasks for today
        await offlineFetch('/api/recurring-tasks/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            targetDate: new Date().toISOString().split('T')[0] 
          }),
        });
        
        // Reload tasks to show newly generated
        await loadTasks();
        
        alert('Recurring task created! Today\'s task has been generated.');
      } else {
        throw new Error('Failed to create recurring task');
      }
    } catch (error) {
      console.error('[Planner] Failed to save recurring task:', error);
      alert('Failed to create recurring task. Please try again.');
    }
  };

  const handleSaveSchedule = async (data: ScheduleTemplateFormData) => {
    if (editingSchedule) {
      // Update existing
      const res = await offlineFetch('/api/schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingSchedule.id, ...data }),
      });
      if (!res.ok) throw new Error('Failed to update schedule');
    } else {
      // Create new
      const res = await offlineFetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create schedule');

      // Backfill from start_date (or today) through today
      const today = new Date().toISOString().split('T')[0];
      const fromDate = data.start_date || today;
      await offlineFetch('/api/schedules/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDate, toDate: today }),
      });
    }

    setEditingSchedule(null);
    await loadSchedules();
    await loadTasks();
  };

  const handleDeleteSchedule = async (scheduleId: string, scheduleName: string) => {
    if (!confirm(`Delete schedule "${scheduleName}"? This will also remove all associated exceptions and pay periods. Generated tasks will remain.`)) return;
    const res = await offlineFetch(`/api/schedules?id=${scheduleId}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Failed to delete schedule');
      return;
    }
    await loadSchedules();
  };

  const handleDeleteRecurringTask = async (taskId: string, taskName: string) => {
    if (!confirm(`Delete recurring task "${taskName}"? Already-generated tasks will remain.`)) return;
    const res = await offlineFetch(`/api/recurring-tasks?id=${taskId}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Failed to delete recurring task');
      return;
    }
    await loadRecurringTasks();
  };

  const handleBackfillSchedule = async (templateId: string) => {
    const tmpl = scheduleTemplates.find(t => t.id === templateId);
    if (!tmpl) return;
    const today = new Date().toISOString().split('T')[0];
    const fromDate = tmpl.start_date || today;

    const dayCount = Math.floor((new Date(today).getTime() - new Date(fromDate).getTime()) / 86400000);
    if (dayCount > 1 && !confirm(`This will generate tasks for ${tmpl.name} from ${fromDate} to ${today} (~${dayCount} days). Continue?`)) {
      return;
    }

    const res = await offlineFetch('/api/schedules/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromDate, toDate: today, templateId }),
    });

    if (res.ok) {
      const data = await res.json();
      alert(`Backfill complete: ${data.tasksGenerated} tasks created.`);
      await loadSchedules();
      await loadTasks();
    } else {
      alert('Backfill failed. Please try again.');
    }
  };

  const handleSyncRevenue = async () => {
    const res = await offlineFetch('/api/schedules/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncRevenue: true }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Revenue synced on ${data.tasksSynced} tasks.`);
      await loadTasks();
    } else {
      alert('Sync failed.');
    }
  };

  const handleConfirmDay = async (data: ConfirmDayData) => {
    // Mark task completed with revenue
    const { error } = await supabase
      .from('tasks')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        revenue: data.revenue,
      })
      .eq('id', data.taskId);

    if (error) throw new Error('Failed to confirm work day');
    await loadTasks();
  };

  const handleDayOff = async (data: DayOffData) => {
    if (!workDayTarget) return;
    const res = await offlineFetch(`/api/schedules/${workDayTarget.templateId}/exceptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save day off');

    // If task exists and exception is unpaid, set revenue to 0
    if (workDayTarget.taskId && (data.exception_type === 'unpaid_off' || data.exception_type === 'skip')) {
      await supabase
        .from('tasks')
        .update({ revenue: 0, activity: `${workDayTarget.name} (${data.exception_type === 'unpaid_off' ? 'Unpaid Day Off' : 'Skipped'})` })
        .eq('id', workDayTarget.taskId);
    }

    await loadSchedules();
    await loadTasks();
  };

  const handlePaycheckReconcile = async (data: ReconcileSaveData) => {
    // Save line items
    const res = await offlineFetch(
      `/api/schedules/${data.templateId}/pay-periods/${data.payPeriodId}/line-items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: data.lineItems, save_as_template: data.saveAsTemplate }),
      }
    );
    if (!res.ok) throw new Error('Failed to save line items');

    // Reconcile the pay period
    await offlineFetch(`/api/schedules/${data.templateId}/pay-periods`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pay_period_id: data.payPeriodId,
        actual_gross: data.actualGross,
        actual_taxes: data.actualTaxes,
        actual_net: data.actualNet,
      }),
    });

    await loadSchedules();
    await loadTasks();
  };

  const handleConvertToInvoice = async (payPeriodId: string) => {
    const period = schedulePayPeriods.find(p => p.id === payPeriodId);
    if (!period) return;
    const res = await offlineFetch(`/api/schedules/${period.template_id}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pay_period_id: payPeriodId }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Invoice ${data.invoice_number || data.invoice_id} created!`);
    } else {
      alert('Failed to create invoice');
    }
  };

  // Schedule indicators for calendar overlay
  const exceptionMap = useMemo(() => {
    const map = new Map<string, ScheduleException>();
    for (const ex of scheduleExceptions) {
      map.set(`${ex.template_id}:${ex.exception_date}`, ex);
    }
    return map;
  }, [scheduleExceptions]);

  const financialSummary = useMemo(() => {
    return tasks.reduce((acc, task) => ({
      estimatedCost: acc.estimatedCost + (task.estimated_cost || 0),
      actualCost: acc.actualCost + (task.actual_cost || 0),
      revenue: acc.revenue + (task.revenue || 0),
      netProfit: acc.netProfit + ((task.revenue || 0) - (task.actual_cost || 0)),
    }), { estimatedCost: 0, actualCost: 0, revenue: 0, netProfit: 0 });
  }, [tasks]);

  // Milestone name lookup for source filtering
  const [milestoneNames, setMilestoneNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = [...new Set([...tasks, ...backlogTasks].map(t => t.milestone_id).filter((id): id is string => !!id && id.length > 0))];
    if (ids.length === 0) return;
    supabase.from('milestones').select('id, name').in('id', ids).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(m => { map[m.id] = m.name; });
        setMilestoneNames(map);
      }
    });
  }, [tasks, backlogTasks, supabase]);

  const filteredTasks = useMemo(() => {
    if (sourceFilter === 'all') return tasks;
    return tasks.filter((task) => {
      if (sourceFilter === 'schedule') return task.source_type === 'schedule';
      if (sourceFilter === 'work') return !!task.source_type && task.source_type !== 'schedule';
      const milestoneName = milestoneNames[task.milestone_id] ?? '';
      const isCalendar = milestoneName.startsWith('Google Calendar:');
      const isRecurring = milestoneName.toLowerCase().includes('recurring');
      if (sourceFilter === 'calendar') return isCalendar;
      if (sourceFilter === 'recurring') return isRecurring;
      // 'manual' = everything else
      return !isCalendar && !isRecurring && task.source_type !== 'schedule';
    });
  }, [tasks, sourceFilter, milestoneNames]);

  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    filteredTasks.forEach(task => {
      if (!grouped[task.date]) grouped[task.date] = [];
      grouped[task.date].push(task);
    });
    return grouped;
  }, [filteredTasks]);

  const completionStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [tasks]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Task Planner</h1>
        <p className="text-gray-600">
          Manage your daily execution
          {backlogTasks.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {backlogTasks.length} in backlog
            </span>
          )}
        </p>
      </header>

      {/* View Controls */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex gap-4 flex-wrap">
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
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-gray-400" />
            {([['all', 'All'], ['calendar', 'Calendar'], ['manual', 'Manual'], ['recurring', 'Recurring'], ['schedule', 'Schedules'], ['work', 'Work']] as [SourceFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSourceFilter(key)}
                className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  sourceFilter === key
                    ? key === 'work' ? 'bg-amber-500 text-white' : key === 'schedule' ? 'bg-sky-500 text-white' : 'bg-fuchsia-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCreateTaskModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
          <button
            onClick={() => setShowRecurringModal(true)}
            className="min-h-11 flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Repeat className="w-4 h-4" />
            <span>Recurring</span>
          </button>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="min-h-11 flex items-center space-x-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Schedule</span>
          </button>
          <Link
            href="/dashboard/data/import/tasks"
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded-lg text-sm font-medium hover:bg-fuchsia-100 transition"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <a
            href="/api/planner/export"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            <Download className="w-4 h-4" />
            Export
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              Today
            </button>
            <Calendar className="w-5 h-5 text-gray-500 hidden sm:block" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
            />
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-linear-to-r from-lime-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white mb-6">
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

      {/* Outstanding Invoices + Expected Payments Widgets (Work.WitUS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {workFeed && workFeed.summary.outstanding_receivable_count > 0 && (
          <OutstandingInvoicesWidget
            outstandingCount={workFeed.summary.outstanding_receivable_count}
            outstandingTotal={workFeed.summary.outstanding_receivable_total}
            overdueCount={workFeed.summary.overdue_count}
          />
        )}
        {workFeed && workFeed.summary.expected_payments_count > 0 && (
          <ExpectedPaymentsWidget
            payments={workFeed.expected_payments}
            totalExpected={workFeed.summary.expected_payments_total}
            count={workFeed.summary.expected_payments_count}
          />
        )}
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No tasks for this period</h2>
          <p className="text-gray-600 mb-4">Create a task to get started</p>
          <button
            onClick={() => setShowCreateTaskModal(true)}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium transition"
          >
            Create a Task
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(tasksByDate).map(([date, dateTasks]) => (
            <div key={date} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric'
                  })}
                </h3>
                {/* Schedule indicators */}
                <div className="flex gap-1">
                  {getScheduleIndicators(date, scheduleTemplates, exceptionMap).map(({ template, exception }) => {
                    const fin = template.finance;
                    const dailyRev = fin
                      ? fin.rate_type === 'hourly' ? fin.pay_rate * (fin.hours_per_day || 8) : fin.rate_type === 'daily' ? fin.pay_rate : 0
                      : 0;
                    // Find the task for this schedule+date to pass to WorkDayModal
                    const matchTask = dateTasks.find(t => t.source_type === 'schedule' && t.source_id === template.id);
                    return (
                      <button
                        key={template.id}
                        onClick={() => setWorkDayTarget({
                          templateId: template.id, date, name: template.name,
                          taskId: matchTask?.id, taskCompleted: matchTask?.completed,
                          finance: fin || undefined,
                        })}
                        className={`min-h-6 px-2 py-0.5 rounded text-[10px] font-medium ${
                          matchTask?.completed
                            ? 'bg-green-100 text-green-700'
                            : exception
                              ? 'bg-gray-100 text-gray-500 line-through'
                              : template.template_type === 'work'
                                ? 'bg-sky-100 text-sky-700'
                                : template.template_type === 'fitness'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-purple-100 text-purple-700'
                        }`}
                        title={exception ? `${template.name} (${exception.exception_type})` : `${template.name}${dailyRev > 0 ? ` — $${dailyRev.toFixed(0)}/day` : ''}`}
                      >
                        {matchTask?.completed && '✓ '}
                        {template.name}
                        {dailyRev > 0 && !exception && <span className="ml-1 opacity-60">${dailyRev.toFixed(0)}</span>}
                        {exception && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
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

      {/* Planned Trips */}
      {plannedTrips.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plane className="w-5 h-5 text-blue-600" />
            Planned Trips
          </h3>
          <div className="space-y-3">
            {plannedTrips.map((trip) => {
              const MODE_ICONS: Record<string, string> = {
                bike: '\u{1F6B2}', car: '\u{1F697}', bus: '\u{1F68C}', train: '\u{1F682}', plane: '\u2708\uFE0F',
                walk: '\u{1F6B6}', run: '\u{1F3C3}', ferry: '\u26F4\uFE0F', rideshare: '\u{1F695}', other: '\u{1F690}',
              };
              const dateStr = new Date(trip.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const endStr = trip.end_date ? ` – ${new Date(trip.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '';
              return (
                <Link
                  key={trip.id}
                  href={`/dashboard/travel/trips/${trip.id}`}
                  className="block p-4 rounded-lg border-l-4 border-blue-500 bg-blue-50/50 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="grow">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{MODE_ICONS[trip.mode] ?? '\u{1F690}'}</span>
                        <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${
                          trip.trip_status === 'planned' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {trip.trip_status === 'in_progress' ? 'In Progress' : 'Planned'}
                        </span>
                        <span className="text-xs text-gray-500">{dateStr}{endStr}</span>
                      </div>
                      <p className="text-gray-900 font-medium">
                        {trip.origin && trip.destination
                          ? `${trip.origin} ${trip.is_round_trip ? '\u2194' : '\u2192'} ${trip.destination}`
                          : trip.notes || `${trip.mode} trip`}
                      </p>
                      {trip.cost != null && trip.cost > 0 && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Est. ${trip.cost.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Work Jobs (Work.WitUS) */}
      {workFeed && (workFeed.jobs.length > 0 || workFeed.assigned_jobs.length > 0) && (
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-600" />
            Work Jobs
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Work.WitUS
            </span>
          </h3>
          <div className="space-y-3">
            {[...workFeed.jobs, ...workFeed.assigned_jobs].map((job) => (
              <WorkJobBlock key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      <BacklogSection
        tasks={backlogTasks}
        milestoneNames={milestoneNames}
        onToggle={handleToggle}
        onEditTask={setEditingTask}
      />

      <EditTaskModal
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={loadTasks}
      />

      <CreateRecurringTaskModal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        onSave={handleSaveRecurringTask}
      />

      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        defaultDate={selectedDate}
        onCreated={loadTasks}
      />

      <TaskCompletionActionsModal
        isOpen={!!completedTask}
        onClose={() => setCompletedTask(null)}
        task={completedTask}
      />

      {/* Active Schedule Pay Periods */}
      {schedulePayPeriods.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-sky-600" />
            Pay Periods
          </h3>
          <div className="space-y-3">
            {schedulePayPeriods.slice(0, 5).map(pp => {
              const tmpl = scheduleTemplates.find(t => t.id === pp.template_id);
              return (
                <PayPeriodCard
                  key={pp.id}
                  payPeriod={pp}
                  scheduleName={tmpl?.name || 'Schedule'}
                  showInvoiceButton={tmpl?.finance?.auto_invoice}
                  onReconcile={() => {
                    if (tmpl) {
                      setPaycheckTarget({
                        templateId: tmpl.id,
                        payPeriodId: pp.id,
                        scheduleName: tmpl.name,
                        periodStart: pp.period_start,
                        periodEnd: pp.period_end,
                        finance: tmpl.finance || undefined,
                        daysWorked: pp.days_worked,
                        estimatedGross: pp.estimated_gross || undefined,
                        estimatedNet: pp.estimated_net || undefined,
                      });
                    }
                  }}
                  onConvertToInvoice={handleConvertToInvoice}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Active Schedules Summary Strip */}
      {scheduleTemplates.filter(t => t.is_active).length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-4 mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-sky-500" />
              Active Schedules
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncRevenue}
                className="min-h-11 text-xs text-amber-600 hover:text-amber-700 font-medium"
                title="Update revenue on existing tasks that have $0"
              >
                Sync Revenue
              </button>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="min-h-11 text-xs text-sky-600 hover:text-sky-700 font-medium"
              >
                + New
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {scheduleTemplates.filter(t => t.is_active).map(tmpl => (
              <div
                key={tmpl.id}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                  tmpl.template_type === 'work'
                    ? 'bg-sky-100 text-sky-700'
                    : tmpl.template_type === 'fitness'
                      ? 'bg-green-100 text-green-700'
                      : tmpl.template_type === 'class'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-amber-100 text-amber-700'
                }`}
              >
                <span>
                  {tmpl.name}
                  <span className="text-[10px] opacity-60 ml-1">
                    {tmpl.schedule_days.length}d/wk
                    {tmpl.week_interval > 1 && ` q${tmpl.week_interval}w`}
                  </span>
                </span>
                {tmpl.start_date && tmpl.start_date < new Date().toISOString().split('T')[0] && (!tmpl.last_generated_date || tmpl.last_generated_date < new Date().toISOString().split('T')[0]) && (
                  <button
                    onClick={() => handleBackfillSchedule(tmpl.id)}
                    className="min-h-6 px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-semibold hover:bg-white transition"
                    title={`Generate past tasks from ${tmpl.start_date} to today`}
                  >
                    Backfill
                  </button>
                )}
                <button
                  onClick={() => { setEditingSchedule(tmpl); setShowScheduleModal(true); }}
                  className="min-h-6 min-w-6 flex items-center justify-center rounded-full hover:bg-white/70 transition"
                  aria-label={`Edit ${tmpl.name}`}
                  title="Edit schedule"
                >
                  <Pencil className="w-3 h-3" aria-hidden="true" />
                </button>
                <button
                  onClick={() => handleDeleteSchedule(tmpl.id, tmpl.name)}
                  className="min-h-6 min-w-6 flex items-center justify-center rounded-full hover:bg-red-200 text-red-600 transition"
                  aria-label={`Delete ${tmpl.name}`}
                  title="Delete schedule"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recurring Tasks Management */}
      {recurringTasks.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-4 mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-purple-500" />
              Recurring Tasks
            </h3>
            <button
              onClick={() => setShowRecurringModal(true)}
              className="min-h-11 text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              + New
            </button>
          </div>
          <div className="space-y-2">
            {recurringTasks.map(rt => (
              <div key={rt.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                    rt.is_active ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {rt.pattern.type}{rt.pattern.weekInterval && rt.pattern.weekInterval > 1 ? ` q${rt.pattern.weekInterval}w` : ''}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{rt.activity}</p>
                    <p className="text-xs text-gray-500">
                      {rt.pattern.daysOfWeek
                        ? rt.pattern.daysOfWeek.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')
                        : rt.pattern.type === 'daily' ? 'Every day'
                        : rt.pattern.type === 'monthly' ? `Day ${rt.pattern.dayOfMonth}`
                        : `Every ${rt.pattern.interval} days`
                      }
                      {' · '}{rt.time}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleDeleteRecurringTask(rt.id, rt.activity)}
                    className="min-h-11 min-w-11 flex items-center justify-center text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                    aria-label={`Delete ${rt.activity}`}
                    title="Delete recurring task"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ScheduleTemplateModal
        isOpen={showScheduleModal}
        onClose={() => { setShowScheduleModal(false); setEditingSchedule(null); }}
        onSave={handleSaveSchedule}
        editData={editingSchedule}
        accounts={scheduleAccounts}
        categories={scheduleCategories}
      />

      <WorkDayModal
        isOpen={!!workDayTarget}
        onClose={() => setWorkDayTarget(null)}
        scheduleName={workDayTarget?.name || ''}
        date={workDayTarget?.date}
        taskId={workDayTarget?.taskId}
        taskCompleted={workDayTarget?.taskCompleted}
        dailyRevenue={
          workDayTarget?.finance
            ? workDayTarget.finance.rate_type === 'hourly'
              ? workDayTarget.finance.pay_rate * (workDayTarget.finance.hours_per_day || 8)
              : workDayTarget.finance.rate_type === 'daily'
                ? workDayTarget.finance.pay_rate
                : 0
            : 0
        }
        payRate={workDayTarget?.finance?.pay_rate}
        rateType={workDayTarget?.finance?.rate_type}
        hoursPerDay={workDayTarget?.finance?.hours_per_day || 8}
        onConfirmDay={handleConfirmDay}
        onDayOff={handleDayOff}
      />

      <PaycheckReconcileModal
        isOpen={!!paycheckTarget}
        onClose={() => setPaycheckTarget(null)}
        templateId={paycheckTarget?.templateId || ''}
        payPeriodId={paycheckTarget?.payPeriodId || ''}
        scheduleName={paycheckTarget?.scheduleName || ''}
        periodStart={paycheckTarget?.periodStart || ''}
        periodEnd={paycheckTarget?.periodEnd || ''}
        estimatedGross={paycheckTarget?.estimatedGross}
        estimatedNet={paycheckTarget?.estimatedNet}
        payRate={paycheckTarget?.finance?.pay_rate}
        rateType={paycheckTarget?.finance?.rate_type}
        hoursPerDay={paycheckTarget?.finance?.hours_per_day || 8}
        daysWorked={paycheckTarget?.daysWorked}
        lineItemTemplates={paycheckTarget?.finance?.line_item_templates}
        onSave={handlePaycheckReconcile}
      />
    </div>
  );
}