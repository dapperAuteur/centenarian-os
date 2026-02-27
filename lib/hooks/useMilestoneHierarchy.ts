'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Roadmap, Goal, Milestone } from '@/lib/types';

interface UseMilestoneHierarchyResult {
  roadmaps: Roadmap[];
  goals: Goal[];
  milestones: Milestone[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useMilestoneHierarchy(): UseMilestoneHierarchyResult {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [roadmapRes, goalRes, milestoneRes] = await Promise.all([
        supabase
          .from('roadmaps')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase
          .from('goals')
          .select('*')
          .eq('status', 'active')
          .order('target_year'),
        supabase
          .from('milestones')
          .select('*')
          .neq('status', 'archived')
          .order('target_date'),
      ]);

      if (roadmapRes.error) throw roadmapRes.error;
      if (goalRes.error) throw goalRes.error;
      if (milestoneRes.error) throw milestoneRes.error;

      setRoadmaps(roadmapRes.data || []);
      setGoals(goalRes.data || []);
      setMilestones(milestoneRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roadmap data');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { roadmaps, goals, milestones, loading, error, reload: load };
}
