// File: lib/types/index.ts

export type TaskTag = 
  | 'FITNESS' 
  | 'CREATIVE' 
  | 'SKILL' 
  | 'OUTREACH' 
  | 'LIFESTYLE' 
  | 'MINDSET' 
  | 'FUEL';

export type GoalStatus = 'active' | 'completed' | 'deferred' | 'archived';
export type MilestoneStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'archived';
export type ItemStatus = 'active' | 'archived';
export type NCVScore = 'Green' | 'Yellow' | 'Red';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface UserProfile {
  id: string;
  user_id: string;
  low_servings_threshold: number | null;
  daily_focus_goal_minutes: number;
  weekly_focus_goal_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface Roadmap {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: ItemStatus;  // ADD
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  estimated_cost: number;
  actual_cost: number;
  revenue: number;
  
}

export interface Goal {
  id: string;
  roadmap_id: string;
  title: string;
  description: string | null;
  category: TaskTag;
  target_year: number;
  archived_at: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
  estimated_cost: number;
  actual_cost: number;
  revenue: number;
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
  estimated_cost: number;
  actual_cost: number;
  revenue: number;
  archived_at: string | null;
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
  estimated_cost: number;
  actual_cost: number;
  revenue: number;
  status: ItemStatus;  // ADD THIS
  archived_at: string | null;
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

// Engine types
export interface FocusSession {
  id: string;
  user_id: string;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  notes: string | null;
  created_at: string;
  hourly_rate: number;
  revenue: number;
  quality_rating?: number | null;
  tags?: string[] | null;
  template_id?: string | null;
  pomodoro_mode: boolean;
  work_intervals: WorkInterval[] | null;
  break_intervals: BreakInterval[] | null;
  net_work_duration: number | null;
  updated_at?: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date: string;
  energy_rating: number | null;
  biggest_win: string | null;
  biggest_challenge: string | null;
  pain_intensity: number | null;
  pain_locations: string[] | null;
  pain_sensations: string[] | null;
  pain_activities: string[] | null;
  pain_notes: string | null;
  created_at: string;
  updated_at: string;
  total_spent: number;
  total_earned: number;
}

export interface WorkInterval {
  start: string; // ISO timestamp
  end: string;
  duration: number; // seconds
}

export interface BreakInterval {
  start: string;
  end: string;
  duration: number; // seconds
  type: 'short' | 'long'; // short = 5min, long = 15min
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

export interface SessionTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  tags: string[];
  hourly_rate: number;
  notes_template: string | null;
  icon: string;
  use_pomodoro: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  duration_minutes: number;
  tags?: string[];
  hourly_rate?: number;
  notes_template?: string;
  icon?: string;
  use_pomodoro?: boolean;
}

export interface ProtocolWithIngredients extends Protocol {
  protocol_ingredients?: (ProtocolIngredient & { ingredient?: Ingredient })[];
}

export interface PomodoroSettings {
  workDuration: number; // minutes
  shortBreakDuration: number; // minutes
  longBreakDuration: number; // minutes
  intervalsBeforeLongBreak: number; // typically 4
  autoStartBreaks: boolean;
  autoStartWork: boolean;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  intervalsBeforeLongBreak: 4,
  autoStartBreaks: true,
  autoStartWork: false,
};

/**
 * Structure of a chat message for the Gemini API
 */
export interface GeminiMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

/**
 * Represents an AI "Gem" persona stored in the database
 */
export interface GemPersona {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a chat session with an AI Gem
 */
export interface LanguageCoachSession {
  id: string;
  user_id: string;
  gem_persona_id: string | null;
  messages: GeminiMessage[]; // Stored as JSONB
  created_at: string;
  updated_at: string;
}

/**
 * Represents a set of flashcards, e.g., "Spanish Verbs"
 */
export interface FlashcardSet {
  id: string;
  user_id: string;
  goal_id: string | null; // Optional link to Planner
  language: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a single flashcard
 */
export interface Flashcard {
  id: string;
  set_id: string;
  user_id: string;
  front_text: string;
  back_text: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Represents the spaced repetition analytics for a single card
 */
export type CardStatus = 'new' | 'strong' | 'shaky' | 'weak';

export interface FlashcardAnalytics {
  id: string;
  card_id: string;
  user_id: string;
  status: CardStatus;
  next_review_at: string; // ISO timestamp
  last_reviewed_at: string | null; // ISO timestamp
  review_count: number;
  correct_count: number;
  incorrect_count: number;
  created_at: string;
  updated_at: string;
}