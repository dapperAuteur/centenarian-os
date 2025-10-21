// File: app/api/debug-data/route.ts
// Visit: http://localhost:3000/api/debug-data

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ 
      error: 'Not authenticated',
      details: authError?.message 
    });
  }

  // Get all data with counts
  const [roadmaps, goals, milestones, tasks, todayTasks] = await Promise.all([
    supabase.from('roadmaps').select('id, title, user_id'),
    supabase.from('goals').select('id, title, roadmap_id'),
    supabase.from('milestones').select('id, title, goal_id'),
    supabase.from('tasks').select('id, date, activity, milestone_id'),
    supabase.from('tasks')
      .select('id, date, time, activity, milestone_id')
      .eq('date', new Date().toISOString().split('T')[0])
  ]);

  // Check ownership chain for tasks
  const { data: taskChain } = await supabase
    .from('tasks')
    .select(`
      id,
      date,
      activity,
      milestone_id,
      milestones (
        id,
        title,
        goal_id,
        goals (
          id,
          title,
          roadmap_id,
          roadmaps (
            id,
            title,
            user_id
          )
        )
      )
    `)
    .limit(5);

  return NextResponse.json({
    currentUser: {
      id: user.id,
      email: user.email
    },
    counts: {
      roadmaps: roadmaps.data?.length || 0,
      goals: goals.data?.length || 0,
      milestones: milestones.data?.length || 0,
      tasks: tasks.data?.length || 0,
      todayTasks: todayTasks.data?.length || 0
    },
    roadmaps: roadmaps.data,
    goals: goals.data,
    milestones: milestones.data,
    tasks: tasks.data?.slice(0, 5), // First 5 tasks
    todayTasks: todayTasks.data,
    taskChain: taskChain,
    errors: {
      roadmaps: roadmaps.error?.message,
      goals: goals.error?.message,
      milestones: milestones.error?.message,
      tasks: tasks.error?.message,
      todayTasks: todayTasks.error?.message
    }
  });
}