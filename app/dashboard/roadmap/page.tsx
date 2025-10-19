// File: app/dashboard/roadmap/page.tsx
// Manage entire planning hierarchy

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Roadmap, Goal, Milestone, Task } from '@/lib/types';
import { Plus, ChevronRight, ChevronDown, Edit, DollarSign } from 'lucide-react';
import { RoadmapModal } from '@/components/RoadmapModal';
import { GoalModal } from '@/components/GoalModal';
import { MilestoneModal } from '@/components/MilestoneModal';
import { TaskModal } from '@/components/TaskModal';
import { EditRoadmapModal } from '@/components/EditRoadmapModal';
import { EditGoalModal } from '@/components/EditGoalModal';
import { EditMilestoneModal } from '@/components/EditMilestoneModal';

export default function RoadmapPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [goals, setGoals] = useState<Record<string, Goal[]>>({});
  const [milestones, setMilestones] = useState<Record<string, Milestone[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRoadmaps, setExpandedRoadmaps] = useState<Set<string>>(new Set());
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [editingRoadmap, setEditingRoadmap] = useState<Roadmap | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  
  // Modal state
  const [roadmapModalOpen, setRoadmapModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const { data: roadmapData } = await supabase
      .from('roadmaps')
      .select('*')
      .order('created_at', { ascending: false });
    if (roadmapData) {
      setRoadmaps(roadmapData);
      
      for (const roadmap of roadmapData) {
        const { data: goalData } = await supabase
          .from('goals')
          .select('*')
          .eq('roadmap_id', roadmap.id)
          .order('target_year');
        if (goalData) {
          setGoals(prev => ({ ...prev, [roadmap.id]: goalData }));
          for (const goal of goalData) {
            const { data: milestoneData } = await supabase
              .from('milestones')
              .select('*')
              .eq('goal_id', goal.id)
              .order('target_date');
            if (milestoneData) {
              setMilestones(prev => ({ ...prev, [goal.id]: milestoneData }));
            }
          }
        }
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  

  const toggleRoadmap = (id: string) => {
    const newExpanded = new Set(expandedRoadmaps);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRoadmaps(newExpanded);
  };

  const toggleGoal = (id: string) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedGoals(newExpanded);
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
        
        <button
          onClick={() => setRoadmapModalOpen(true)}
          className="flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Roadmap
        </button>
      </header>

      {roadmaps.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Roadmaps Yet</h2>
          <p className="text-gray-600 mb-6">Create your first roadmap to start planning your journey</p>
          <button
            onClick={() => setRoadmapModalOpen(true)}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
          >
            Create Roadmap
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {roadmaps.map((roadmap) => {
            const roadmapGoals = goals[roadmap.id] || [];
            const isExpanded = expandedRoadmaps.has(roadmap.id);

            return (
              <div key={roadmap.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Roadmap Header */}
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
                    <div className="flex items-center gap-4">
                    {(roadmap.actual_cost > 0 || roadmap.revenue > 0) && (
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          ${((roadmap.revenue || 0) - (roadmap.actual_cost || 0)).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">Net</div>
                      </div>
                    )}
                    <button
                      onClick={() => setEditingRoadmap(roadmap)}
                      className="p-2 hover:bg-gray-100 rounded transition"
                    >
                      <Edit className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                    <button
                      onClick={() => openGoalModal(roadmap.id)}
                      className="flex items-center px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Goal
                    </button>
                  </div>
                </div>

                {/* Goals */}
                {isExpanded && (
                  <div className="p-6 space-y-4">
                    {roadmapGoals.map(goal => {
                    const goalMilestones = milestones[goal.id] || [];
                        const isGoalExpanded = expandedGoals.has(goal.id);

                        return (
                          <div key={goal.id} className="border-l-4 border-sky-500 bg-gray-50 rounded-lg">
                            <div className="p-4">
                              <div className="flex justify-between items-start">
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
                                <button
                                  onClick={() => openMilestoneModal(goal.id)}
                                  className="flex items-center px-3 py-2 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-lg transition"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Milestone
                                </button>
                              </div>

                              {/* Milestones */}
                              {isGoalExpanded && (
                                <div className="mt-4 ml-7 space-y-2">
                                  {goalMilestones.length === 0 ? (
                                    <div className="text-center py-4 text-gray-500 text-sm">
                                      No milestones. Click &quot;+ Milestone&quot; to create one.
                                    </div>
                                  ) : (
                                    goalMilestones.map((milestone) => (
                                      <div
                                        key={milestone.id}
                                        className="bg-white p-3 rounded-lg border border-gray-200"
                                      >
                                        <div className="flex justify-between items-start">
                                          <div className="flex-grow">
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
                                          <button
                                            onClick={() => openTaskModal(milestone.id)}
                                            className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm"
                                          >
                                            <Plus className="w-4 h-4 mr-1" />
                                            Task
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
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
    </div>
  );
}