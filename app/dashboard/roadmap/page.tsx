'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Roadmap, Goal, Milestone, Task } from '@/lib/types';
import { Plus, ChevronRight, ChevronDown, Edit, Trash2, Archive, RotateCcw } from 'lucide-react';
import { RoadmapModal } from '@/components/RoadmapModal';
import { GoalModal } from '@/components/GoalModal';
import { MilestoneModal } from '@/components/MilestoneModal';
import { TaskModal } from '@/components/TaskModal';
import { EditRoadmapModal } from '@/components/EditRoadmapModal';
import { EditGoalModal } from '@/components/EditGoalModal';
import { EditMilestoneModal } from '@/components/EditMilestoneModal';
import { EditTaskModal } from '@/components/EditTaskModal';
import { ArchiveModal } from '@/components/ArchiveModal';

export default function RoadmapPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [goals, setGoals] = useState<Record<string, Goal[]>>({});
  const [milestones, setMilestones] = useState<Record<string, Milestone[]>>({});
  const [tasks, setTasks] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRoadmaps, setExpandedRoadmaps] = useState<Set<string>>(new Set());
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [archiveCounts, setArchiveCounts] = useState({ roadmaps: 0, goals: 0, milestones: 0, tasks: 0 });
  
  // Edit modals
  const [editingRoadmap, setEditingRoadmap] = useState<Roadmap | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Archive modal
  const [archiveTarget, setArchiveTarget] = useState<{
    type: 'roadmap' | 'goal' | 'milestone';
    item: { id: string; title: string };
    childrenCount: number;
    moveOptions: Array<{ id: string; title: string }>;
  } | null>(null);
  
  // Create modals
  const [roadmapModalOpen, setRoadmapModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    const status = showArchived ? 'archived' : 'active';
    
    // const { data: roadmapData } = await supabase
    //   .from('roadmaps')
    //   .select('*')
    //   .eq('status', status)
    //   .order('created_at', { ascending: false });
      
    // if (roadmapData) {
    //   setRoadmaps(roadmapData);
      
    //   for (const roadmap of roadmapData) {
    //     const { data: goalData } = await supabase
    //       .from('goals')
    //       .select('*')
    //       .eq('roadmap_id', roadmap.id)
    //       .eq('status', status)
    //       .order('target_year');
          
    //     if (goalData) {
    //       setGoals(prev => ({ ...prev, [roadmap.id]: goalData }));
          
    //       for (const goal of goalData) {
    //         console.log('goal.id :>> ', goal.id);
    //         const { data: milestoneData } = await supabase
    //           .from('milestones')
    //           .select('*')
    //           .eq('goal_id', goal.id)
    //           .eq('status', status)
    //           .order('target_date');
    //         if (milestoneData) {
              
    //           setMilestones(prev => ({ ...prev, [goal.id]: milestoneData }));
              
    //           for (const milestone of milestoneData) {
    //             const { data: taskData } = await supabase
    //               .from('tasks')
    //               .select('*')
    //               .eq('milestone_id', milestone.id)
    //               .eq('status', status)
    //               .order('time');
                  
    //             if (taskData) {
    //               setTasks(prev => ({ ...prev, [milestone.id]: taskData }));
    //             }
    //           }
    //         }
    //       }
    //     }
    //   }
    // }

    // Fetch all data in parallel
    const [roadmapRes, goalRes, milestoneRes, taskRes] = await Promise.all([
      supabase.from('roadmaps').select('*').eq('status', status).order('created_at', { ascending: false }),
      supabase.from('goals').select('*').eq('status', status).order('target_year'),
      // Milestones and Tasks use different "active" statuses.
      // When not showing archived, we get everything that ISN'T archived.
      status === 'active'
        ? supabase.from('milestones').select('*').neq('status', 'archived').order('target_date')
        : supabase.from('milestones').select('*').eq('status', 'archived').order('target_date'),
      status === 'active'
        ? supabase.from('tasks').select('*').neq('status', 'archived').order('time')
        : supabase.from('tasks').select('*').eq('status', 'archived').order('time'),
    ]);

    const roadmapData = roadmapRes.data || [];
    const goalData = goalRes.data || [];
    const milestoneData = milestoneRes.data || [];
    const taskData = taskRes.data || [];

    console.log('roadmapData :>> ', roadmapData);
    console.log('goalData :>> ', goalData);
    console.log('milestoneData :>> ', milestoneData);
    console.log('taskData :>> ', taskData);

    // Organize data into the required state shape
    const goalsByRoadmap: Record<string, Goal[]> = goalData.reduce((acc, goal) => {
      if (!goal.roadmap_id) return acc;
      if (!acc[goal.roadmap_id]) {
        acc[goal.roadmap_id] = [];
      }
      acc[goal.roadmap_id].push(goal);
      return acc;
    }, {} as Record<string, Goal[]>);

    const milestonesByGoal: Record<string, Milestone[]> = milestoneData.reduce((acc, milestone) => {
      if (!milestone.goal_id) return acc;
      if (!acc[milestone.goal_id]) {
        acc[milestone.goal_id] = [];
      }
      acc[milestone.goal_id].push(milestone);
      return acc;
    }, {} as Record<string, Milestone[]>);

    const tasksByMilestone: Record<string, Task[]> = taskData.reduce((acc, task) => {
      if (!task.milestone_id) return acc;
      if (!acc[task.milestone_id]) {
        acc[task.milestone_id] = [];
      }
      acc[task.milestone_id].push(task);
     return acc;
    }, {} as Record<string, Task[]>);

    setRoadmaps(roadmapData);
    setGoals(goalsByRoadmap);
    setMilestones(milestonesByGoal);
    setTasks(tasksByMilestone);
    
    // Load archive counts
    const [rCount, gCount, mCount, tCount] = await Promise.all([
      supabase.from('roadmaps').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
      supabase.from('goals').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
      supabase.from('milestones').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
    ]);
    
    setArchiveCounts({
      roadmaps: rCount.count || 0,
      goals: gCount.count || 0,
      milestones: mCount.count || 0,
      tasks: tCount.count || 0
    });
    
    setLoading(false);
  }, [supabase, showArchived]); 
  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
    // console.log('tasks :>> ', tasks);
    // console.log('milestones :>> ', milestones);
    // console.log('goals :>> ', goals);
    // console.log('roadmaps :>> ', roadmaps);
  }, [loadData]);

  // This is a one-time operation on mount to clear any stale data.
  // It's not strictly necessary with the new loadData, but can be good practice.
  useEffect(() => {
    setRoadmaps([]);
    setGoals({});
    setMilestones({});
    setTasks({});
  }, [showArchived]);

  const toggleRoadmap = (id: string) => {
    const newExpanded = new Set(expandedRoadmaps);
    newExpanded.has(id) ? newExpanded.delete(id) : newExpanded.add(id);
    setExpandedRoadmaps(newExpanded);
  };

  const toggleGoal = (id: string) => {
    const newExpanded = new Set(expandedGoals);
    newExpanded.has(id) ? newExpanded.delete(id) : newExpanded.add(id);
    setExpandedGoals(newExpanded);
  };

  const toggleMilestone = (id: string) => {
    const newExpanded = new Set(expandedMilestones);
    newExpanded.has(id) ? newExpanded.delete(id) : newExpanded.add(id);
    setExpandedMilestones(newExpanded);
  };

  const openGoalModal = (roadmapId: string) => {
    setSelectedRoadmap(roadmapId);
    setGoalModalOpen(true);
  };

  const openMilestoneModal = (goalId: string) => {
    setSelectedGoal(goalId);
    setMilestoneModalOpen(true);
  };

  const openTaskModal = (milestoneId: string) => {
    setSelectedMilestone(milestoneId);
    setTaskModalOpen(true);
  };

  // Archive handlers
  const handleArchiveRoadmap = async (roadmapId: string, title: string) => {
    const { data: childGoals } = await supabase
      .from('goals')
      .select('id, title')
      .eq('roadmap_id', roadmapId)
      .eq('status', 'active');
      
    const { data: otherRoadmaps } = await supabase
      .from('roadmaps')
      .select('id, title')
      .neq('id', roadmapId)
      .eq('status', 'active');
      
    setArchiveTarget({
      type: 'roadmap',
      item: { id: roadmapId, title },
      childrenCount: childGoals?.length || 0,
      moveOptions: otherRoadmaps || []
    });
  };

  const handleArchiveGoal = async (goalId: string, title: string) => {
    const { data: childMilestones } = await supabase
      .from('milestones')
      .select('id, title')
      .eq('goal_id', goalId)
      .eq('status', 'active');
      
    const goal = Object.values(goals).flat().find(g => g.id === goalId);
    const { data: otherGoals } = await supabase
      .from('goals')
      .select('id, title')
      .eq('roadmap_id', goal?.roadmap_id)
      .neq('id', goalId)
      .eq('status', 'active');
      
    setArchiveTarget({
      type: 'goal',
      item: { id: goalId, title },
      childrenCount: childMilestones?.length || 0,
      moveOptions: otherGoals || []
    });
  };

  const handleArchiveMilestone = async (milestoneId: string, title: string) => {
    const { data: childTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('milestone_id', milestoneId)
      .eq('status', 'active');
      
    const milestone = Object.values(milestones).flat().find(m => m.id === milestoneId);
    const { data: otherMilestones } = await supabase
      .from('milestones')
      .select('id, title')
      .eq('goal_id', milestone?.goal_id)
      .neq('id', milestoneId)
      .eq('status', 'active');
      
    setArchiveTarget({
      type: 'milestone',
      item: { id: milestoneId, title },
      childrenCount: childTasks?.length || 0,
      moveOptions: otherMilestones || []
    });
  };

  const executeArchive = async (cascade: boolean, newParentId?: string) => {
    if (!archiveTarget) return;
    
    const { type, item } = archiveTarget;
    const now = new Date().toISOString();
    
    if (type === 'roadmap') {
      if (newParentId) {
        await supabase
          .from('goals')
          .update({ roadmap_id: newParentId })
          .eq('roadmap_id', item.id)
          .eq('status', 'active');
      } else if (cascade) {
        const { data: goals } = await supabase
          .from('goals')
          .select('id')
          .eq('roadmap_id', item.id)
          .eq('status', 'active');
        const goalIds = goals?.map(g => g.id) || [];
        
        if (goalIds.length > 0) {
          const { data: milestones } = await supabase
            .from('milestones')
            .select('id')
            .in('goal_id', goalIds)
            .eq('status', 'active');
          const milestoneIds = milestones?.map(m => m.id) || [];
          
          if (milestoneIds.length > 0) {
            await supabase
              .from('tasks')
              .update({ status: 'archived', archived_at: now })
              .in('milestone_id', milestoneIds);
          }
          
          await supabase
            .from('milestones')
            .update({ status: 'archived', archived_at: now })
            .in('goal_id', goalIds);
        }
        
        await supabase
          .from('goals')
          .update({ status: 'archived', archived_at: now })
          .eq('roadmap_id', item.id);
      }
      
      await supabase
        .from('roadmaps')
        .update({ status: 'archived', archived_at: now })
        .eq('id', item.id);
        
    } else if (type === 'goal') {
      if (newParentId) {
        await supabase
          .from('milestones')
          .update({ goal_id: newParentId })
          .eq('goal_id', item.id)
          .eq('status', 'active');
      } else if (cascade) {
        const { data: milestones } = await supabase
          .from('milestones')
          .select('id')
          .eq('goal_id', item.id)
          .eq('status', 'active');
        const milestoneIds = milestones?.map(m => m.id) || [];
        
        if (milestoneIds.length > 0) {
          await supabase
            .from('tasks')
            .update({ status: 'archived', archived_at: now })
            .in('milestone_id', milestoneIds);
        }
        
        await supabase
          .from('milestones')
          .update({ status: 'archived', archived_at: now })
          .eq('goal_id', item.id);
      }
      
      await supabase
        .from('goals')
        .update({ status: 'archived', archived_at: now })
        .eq('id', item.id);
        
    } else if (type === 'milestone') {
      if (newParentId) {
        await supabase
          .from('tasks')
          .update({ milestone_id: newParentId })
          .eq('milestone_id', item.id)
          .eq('status', 'active');
      } else if (cascade) {
        await supabase
          .from('tasks')
          .update({ status: 'archived', archived_at: now })
          .eq('milestone_id', item.id);
      }
      
      await supabase
        .from('milestones')
        .update({ status: 'archived', archived_at: now })
        .eq('id', item.id);
    }
    
    setArchiveTarget(null);
    loadData();
  };

  // Restore handler
  const handleRestore = async (table: string, id: string) => {
    await supabase
      .from(table)
      .update({ status: 'active', archived_at: null })
      .eq('id', id);
    loadData();
  };

  // Delete handler
  const handlePermanentDelete = async (table: string, id: string, archivedAt: string) => {
    const daysArchived = Math.floor((Date.now() - new Date(archivedAt).getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = 30 - daysArchived;
    
    const warning = daysRemaining > 0
      ? `⚠️ Auto-delete in ${daysRemaining} days. Delete permanently now?`
      : '⚠️ Permanent deletion. Cannot be undone.';
      
    if (!confirm(warning)) return;
    
    await supabase.from(table).delete().eq('id', id);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Roadmap Builder</h1>
          <p className="text-gray-600">Manage your multi-decade journey hierarchy</p>
        </div>
        
        <div className="items-center gap-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`relative px-4 py-2 rounded-lg transition ${
              showArchived ? 'bg-gray-600' : 'bg-sky-600'
            } text-white font-semibold`}
          >
            {showArchived ? 'Show Active' : 'Show Archived'}
            {!showArchived && archiveCounts.roadmaps > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                {archiveCounts.roadmaps}
              </span>
            )}
          </button>
          
          {!showArchived && (
            <button
              onClick={() => setRoadmapModalOpen(true)}
              className="flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Roadmap
            </button>
          )}
        </div>
      </header>

      {roadmaps.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {showArchived ? 'No Archived Roadmaps' : 'No Roadmaps Yet'}
          </h2>
          <p className="text-gray-600 mb-6">
            {showArchived ? 'Your archived items will appear here' : 'Create your first roadmap to start planning your journey'}
          </p>
          {!showArchived && (
            <button
              onClick={() => setRoadmapModalOpen(true)}
              className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
            >
              Create Roadmap
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {roadmaps.map((roadmap) => {
            const roadmapGoals = goals[roadmap.id] || [];
            const isExpanded = expandedRoadmaps.has(roadmap.id);

            return (
              <div key={roadmap.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-sky-500 to-indigo-600 text-white">
                  <div className="flex justify-between items-start">
                    <button
                      onClick={() => toggleRoadmap(roadmap.id)}
                      className="flex items-center flex-grow text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-6 h-6 mr-2 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-6 h-6 mr-2 flex-shrink-0" />
                      )}
                      <div>
                        <h2 className="text-2xl font-bold">{roadmap.title}</h2>
                        <p className="text-sky-100 mt-1">{roadmap.description}</p>
                        <p className="text-sm text-sky-200 mt-2">
                          {new Date(roadmap.start_date).getFullYear()} - {new Date(roadmap.end_date).getFullYear()}
                        </p>
                      </div>
                    </button>
                    <div className="items-center gap-2">
                      {showArchived ? (
                        <>
                          <button
                            onClick={() => handleRestore('roadmaps', roadmap.id)}
                            className="p-2 hover:bg-white/30 rounded transition"
                            title="Restore"
                          >
                            <RotateCcw className="w-5 h-5 text-white" />
                          </button>
                          <button
                            onClick={() => handlePermanentDelete('roadmaps', roadmap.id, roadmap.archived_at!)}
                            className="p-2 hover:bg-white/30 rounded transition"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-5 h-5 text-red-300" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingRoadmap(roadmap)}
                            className="p-2 hover:bg-white/30 rounded transition"
                          >
                            <Edit className="w-5 h-5 text-white" />
                          </button>
                          <button
                            onClick={() => handleArchiveRoadmap(roadmap.id, roadmap.title)}
                            className="p-2 hover:bg-white/30 rounded transition"
                          >
                            <Archive className="w-5 h-5 text-white" />
                          </button>
                          <button
                            onClick={() => openGoalModal(roadmap.id)}
                            className="flex items-center px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Goal
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 space-y-4">
                    {roadmapGoals.map(goal => {
                      const goalMilestones = milestones[goal.id] || [];
                      const isGoalExpanded = expandedGoals.has(goal.id);

                      return (
                        <div key={goal.id} className="border-l-4 border-sky-500 bg-gray-50 rounded-lg">
                          <div className="p-4">
                            <div className="justify-between items-start">
                              <button
                                onClick={() => toggleGoal(goal.id)}
                                className="flex items-center flex-grow text-left"
                              >
                                {isGoalExpanded ? (
                                  <ChevronDown className="w-5 h-5 mr-2 flex-shrink-0 text-gray-600" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 mr-2 flex-shrink-0 text-gray-600" />
                                )}
                                <div>
                                  <h3 className="text-xl font-bold text-gray-900">{goal.title}</h3>
                                  <p className="text-gray-600 text-sm mt-1">{goal.description}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs px-2 py-1 bg-sky-100 text-sky-700 rounded-full">
                                      {goal.category}
                                    </span>
                                    <span className="text-xs text-gray-500">Target: {goal.target_year}</span>
                                  </div>
                                </div>
                              </button>
                              <div className="flex items-center gap-2">
                                {showArchived ? (
                                  <>
                                    <button
                                      onClick={() => handleRestore('goals', goal.id)}
                                      className="p-2 hover:bg-gray-200 rounded"
                                    >
                                      <RotateCcw className="w-4 h-4 text-gray-600" />
                                    </button>
                                    <button
                                      onClick={() => handlePermanentDelete('goals', goal.id, goal.archived_at!)}
                                      className="p-2 hover:bg-gray-200 rounded"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => setEditingGoal(goal)}
                                      className="p-2 hover:bg-gray-200 rounded"
                                    >
                                      <Edit className="w-4 h-4 text-gray-500" />
                                    </button>
                                    <button
                                      onClick={() => handleArchiveGoal(goal.id, goal.title)}
                                      className="p-2 hover:bg-gray-200 rounded"
                                    >
                                      <Archive className="w-4 h-4 text-gray-500" />
                                    </button>
                                    <button
                                      onClick={() => openMilestoneModal(goal.id)}
                                      className="flex items-center px-3 py-2 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-lg transition"
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      Milestone
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {isGoalExpanded && (
                              <div className="mt-4 ml-7 space-y-2">
                                {goalMilestones.length === 0 ? (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    No milestones. Click &quot;+ Milestone&quot; to create one.
                                  </div>
                                ) : (
                                  goalMilestones.map((milestone) => {
                                    const milestoneTasks = tasks[milestone.id] || [];
                                    const isMilestoneExpanded = expandedMilestones.has(milestone.id);

                                    return (
                                      <div key={milestone.id} className="bg-white p-3 rounded-lg border border-gray-200">
                                        <div className="justify-between items-start">
                                          <button
                                            onClick={() => toggleMilestone(milestone.id)}
                                            className="flex items-center flex-grow text-left"
                                          >
                                            {isMilestoneExpanded ? (
                                              <ChevronDown className="w-4 h-4 mr-2 text-gray-600" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4 mr-2 text-gray-600" />
                                            )}
                                            <div>
                                              <h4 className="font-semibold text-gray-900">{milestone.title}</h4>
                                              <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                                              <div className="flex items-center gap-2 mt-2">
                                                <span className={`text-xs px-2 py-1 rounded-full ${
                                                  milestone.status === 'completed' ? 'bg-lime-100 text-lime-700' :
                                                  milestone.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                                                  milestone.status === 'blocked' ? 'bg-red-100 text-red-700' :
                                                  'bg-gray-100 text-gray-700'
                                                }`}>
                                                  {milestone.status.replace('_', ' ')}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                  Due: {new Date(milestone.target_date).toLocaleDateString()}
                                                </span>
                                              </div>                                            
                                            </div>
                                          </button>
                                          <div className="items-center gap-2">
                                            {showArchived ? (
                                              <>
                                                <button
                                                  onClick={() => handleRestore('milestones', milestone.id)}
                                                  className="p-2 hover:bg-gray-100 rounded"
                                                >
                                                  <RotateCcw className="w-3 h-3 text-gray-600" />
                                                </button>
                                                <button
                                                  onClick={() => handlePermanentDelete('milestones', milestone.id, milestone.archived_at!)}
                                                  className="p-2 hover:bg-gray-100 rounded"
                                                >
                                                  <Trash2 className="w-3 h-3 text-red-500" />
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  onClick={() => setEditingMilestone(milestone)}
                                                  className="p-2 hover:bg-gray-100 rounded"
                                                >
                                                  <Edit className="w-4 h-4 text-gray-500" />
                                                </button>
                                                <button
                                                  onClick={() => handleArchiveMilestone(milestone.id, milestone.title)}
                                                  className="p-2 hover:bg-gray-100 rounded"
                                                >
                                                  <Archive className="w-4 h-4 text-gray-500" />
                                                </button>
                                                <button
                                                  onClick={() => openTaskModal(milestone.id)}
                                                  className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm"
                                                >
                                                  <Plus className="w-4 h-4 mr-1" />
                                                  Task
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>

                                        {isMilestoneExpanded && (
                                          <div className="mt-3 ml-6 space-y-2">
                                            {milestoneTasks.map(task => (
                                              <div key={task.id} className="bg-gray-50 p-2 rounded border border-gray-200 flex justify-between items-start">
                                                <div className="flex-grow">
                                                  <p className="text-sm font-medium text-gray-900">{task.activity}</p>
                                                  <p className="text-xs text-gray-500">{task.time}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  {showArchived ? (
                                                    <>
                                                      <button
                                                        onClick={() => handleRestore('tasks', task.id)}
                                                        className="p-1 hover:bg-gray-200 rounded"
                                                      >
                                                        <RotateCcw className="w-3 h-3 text-gray-600" />
                                                      </button>
                                                      <button
                                                        onClick={() => handlePermanentDelete('tasks', task.id, task.archived_at!)}
                                                        className="p-1 hover:bg-gray-200 rounded"
                                                      >
                                                        <Trash2 className="w-3 h-3 text-red-500" />
                                                      </button>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <button
                                                        onClick={() => setEditingTask(task)}
                                                        className="p-1 hover:bg-gray-200 rounded"
                                                      >
                                                        <Edit className="w-3 h-3 text-gray-500" />
                                                      </button>
                                                      <button
                                                        onClick={async () => {
                                                          if (confirm('Archive this task?')) {
                                                            await supabase
                                                              .from('tasks')
                                                              .update({ status: 'archived', archived_at: new Date().toISOString() })
                                                              .eq('id', task.id);
                                                            loadData();
                                                          }
                                                        }}
                                                        className="p-1 hover:bg-gray-200 rounded"
                                                      >
                                                        <Archive className="w-3 h-3 text-gray-500" />
                                                      </button>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modals */}
      <RoadmapModal
        isOpen={roadmapModalOpen}
        onClose={() => {
          setRoadmapModalOpen(false);
          loadData();
        }}
      />
      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => {
          setGoalModalOpen(false);
          setSelectedRoadmap(null);
          loadData();
        }}
        roadmapId={selectedRoadmap}
      />
      <MilestoneModal
        isOpen={milestoneModalOpen}
        onClose={() => {
          setMilestoneModalOpen(false);
          setSelectedGoal(null);
          loadData();
        }}
        goalId={selectedGoal}
      />
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setSelectedMilestone(null);
          loadData();
        }}
        milestoneId={selectedMilestone}
      />

      {/* Edit Modals */}
      {editingRoadmap && (
        <EditRoadmapModal
          roadmap={editingRoadmap}
          isOpen={!!editingRoadmap}
          onClose={() => setEditingRoadmap(null)}
          onSave={() => {
            setEditingRoadmap(null);
            loadData();
          }}
        />
      )}

      {editingGoal && (
        <EditGoalModal
          goal={editingGoal}
          isOpen={!!editingGoal}
          onClose={() => setEditingGoal(null)}
          onSave={() => {
            setEditingGoal(null);
            loadData();
          }}
        />
      )}

      {editingMilestone && (
        <EditMilestoneModal
          milestone={editingMilestone}
          isOpen={!!editingMilestone}
          onClose={() => setEditingMilestone(null)}
          onSave={() => {
            setEditingMilestone(null);
            loadData();
          }}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          onSave={() => {
            setEditingTask(null);
            loadData();
          }}
        />
      )}

      {/* Archive Modal */}
      {archiveTarget && (
        <ArchiveModal
          type={archiveTarget.type}
          item={archiveTarget.item}
          childrenCount={archiveTarget.childrenCount}
          moveOptions={archiveTarget.moveOptions}
          onArchive={executeArchive}
          onClose={() => setArchiveTarget(null)}
        />
      )}
    </div>
  );
}