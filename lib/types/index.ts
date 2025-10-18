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
export type NCVScore = 'Green' | 'Yellow' | 'Red';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

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

// Nutrition types
export interface Ingredient {
  id: string;
  user_id: string;
  name: string;
  ncv_score: NCVScore;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  cost_per_unit: number;
  unit: string;
  notes: string | null;
  usda_fdc_id: string | null;
  brand: string | null;
  store_name: string | null;
  store_website: string | null;
  vendor_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Protocol {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  ncv_score: NCVScore;
  total_cost: number;
  total_calories: number;
  total_protein: number;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  date_made: string | null;
  date_finished: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProtocolIngredient {
  id: string;
  protocol_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  created_at: string;
}

export interface Inventory {
  id: string;
  user_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  last_restocked: string;
  created_at: string;
  updated_at: string;
}

export interface MealLog {
  id: string;
  user_id: string;
  date: string;
  time: string;
  protocol_id: string | null;
  meal_type: MealType | null;
  notes: string | null;
  restaurant_name: string | null;
  restaurant_address: string | null;
  restaurant_city: string | null;
  restaurant_state: string | null;
  restaurant_country: string | null;
  restaurant_website: string | null;
  is_restaurant_meal: boolean;
  created_at: string;
}

export interface MealPrepBatch {
  id: string;
  user_id: string;
  protocol_id: string;
  date_made: string;
  date_finished: string | null;
  servings_made: number;
  servings_remaining: number;
  storage_location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
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

export interface ProtocolWithIngredients extends Protocol {
  protocol_ingredients?: (ProtocolIngredient & { ingredient?: Ingredient })[];
}