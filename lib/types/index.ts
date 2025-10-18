// File: lib/types/index.ts

export type TaskTag = 
  | 'FITNESS' 
  | 'CREATIVE' 
  | 'SKILL' 
  | 'OUTREACH' 
  | 'LIFESTYLE' 
  | 'MINDSET' 
  | 'FUEL';

export type GoalStatus = 'active' | 'completed' | 'deferred';
export type MilestoneStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export interface Roadmap {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  roadmap_id: string;
  title: string;
  description: string | null;
  category: TaskTag;
  target_year: number;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  target_date: string;
  status: MilestoneStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  milestone_id: string;
  date: string;
  time: string;
  activity: string;
  description: string | null;
  tag: TaskTag;
  priority: 1 | 2 | 3;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Extended types with relations for UI
export interface TaskWithMilestone extends Task {
  milestone?: Milestone;
}

export interface MilestoneWithGoal extends Milestone {
  goal?: Goal;
  tasks?: Task[];
}

export interface GoalWithMilestones extends Goal {
  milestones?: Milestone[];
}