'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Roadmap, Goal, Milestone } from '@/lib/types';
import { Plus, ChevronDown, ChevronRight, Edit, DollarSign } from 'lucide-react';
import { EditRoadmapModal } from '@/components/EditRoadmapModal';
import { EditGoalModal } from '@/components/EditGoalModal';
import { EditMilestoneModal } from '@/components/EditMilestoneModal';

export default function RoadmapPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [goals, setGoals] = useState<Record<string, Goal[]>>({});
  const [milestones, setMilestones] = useState<Record<string, Milestone[]>>({});
  const [expandedRoadmaps, setExpandedRoadmaps] = useState<Set<string>>(new Set());
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editingRoadmap, setEditingRoadmap] = useState<Roadmap | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
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
    setExpandedRoadmaps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGoal = (id: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Roadmap</h1>
        <p className="text-gray-600">Your multi-decade journey</p>
      </header>

      <div className="space-y-4">
        {roadmaps.map(roadmap => {
          const roadmapGoals = goals[roadmap.id] || [];
          const isExpanded = expandedRoadmaps.has(roadmap.id);

          return (
            <div key={roadmap.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleRoadmap(roadmap.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900">{roadmap.title}</h2>
                      <p className="text-sm text-gray-500">
                        {new Date(roadmap.start_date).getFullYear()} - {new Date(roadmap.end_date).getFullYear()}
                      </p>
                    </div>
                  </div>
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
                </div>
              </div>

              {isExpanded && (
                <div className="p-6 space-y-4">
                  {roadmapGoals.map(goal => {
                    const goalMilestones = milestones[goal.id] || [];
                    const isGoalExpanded = expandedGoals.has(goal.id);

                    return (
                      <div key={goal.id} className="bg-gray-50 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <button
                                onClick={() => toggleGoal(goal.id)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                {isGoalExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900">{goal.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs px-2 py-1 rounded-full bg-sky-500 text-white">
                                    {goal.category}
                                  </span>
                                  <span className="text-xs text-gray-500">Target: {goal.target_year}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {(goal.actual_cost > 0 || goal.revenue > 0) && (
                                <div className="text-right">
                                  <div className="text-sm font-bold text-gray-900">
                                    ${((goal.revenue || 0) - (goal.actual_cost || 0)).toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-500">Net</div>
                                </div>
                              )}
                              <button
                                onClick={() => setEditingGoal(goal)}
                                className="p-1 hover:bg-gray-100 rounded transition"
                              >
                                <Edit className="w-4 h-4 text-gray-500" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {isGoalExpanded && (
                          <div className="p-4 space-y-2">
                            {goalMilestones.map(milestone => (
                              <div key={milestone.id} className="bg-white p-3 rounded-lg flex items-center justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900">{milestone.title}</h4>
                                  <p className="text-xs text-gray-500">
                                    Target: {new Date(milestone.target_date).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    milestone.status === 'completed' ? 'bg-lime-100 text-lime-700' :
                                    milestone.status === 'in_progress' ? 'bg-sky-100 text-sky-700' :
                                    milestone.status === 'blocked' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {milestone.status.replace('_', ' ')}
                                  </span>
                                  {(milestone.actual_cost > 0 || milestone.revenue > 0) && (
                                    <div className="text-xs font-semibold">
                                      ${((milestone.revenue || 0) - (milestone.actual_cost || 0)).toFixed(2)}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => setEditingMilestone(milestone)}
                                    className="p-1 hover:bg-gray-100 rounded transition"
                                  >
                                    <Edit className="w-3 h-3 text-gray-500" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingRoadmap && (
        <EditRoadmapModal
          roadmap={editingRoadmap}
          isOpen={!!editingRoadmap}
          onClose={() => setEditingRoadmap(null)}
          onSave={loadData}
        />
      )}

      {editingGoal && (
        <EditGoalModal
          goal={editingGoal}
          isOpen={!!editingGoal}
          onClose={() => setEditingGoal(null)}
          onSave={loadData}
        />
      )}

      {editingMilestone && (
        <EditMilestoneModal
          milestone={editingMilestone}
          isOpen={!!editingMilestone}
          onClose={() => setEditingMilestone(null)}
          onSave={loadData}
        />
      )}
    </div>
  );
}