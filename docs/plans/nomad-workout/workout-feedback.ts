// types/workout-feedback.ts

/** Which activity the user completed */
export interface WorkoutActivitySelection {
  category: 'AM' | 'PM' | 'WORKOUT_HOTEL' | 'WORKOUT_GYM' | 'friction'
  /** Duration chosen (e.g., '5', '15', '30', '45') — null if friction protocol */
  duration: string | null
  /** For friction protocol, which scenario index (0-3) */
  frictionScenarioIndex?: number
}

/** Mood rating on a 1-5 scale */
export type MoodRating = 1 | 2 | 3 | 4 | 5

/** Difficulty preference */
export type DifficultyPreference = 'easier' | 'just-right' | 'harder'

/** Instruction format preference */
export type InstructionPreference = 'text-is-fine' | 'need-images' | 'need-video'

/** The full form data submitted by the user */
export interface WorkoutFeedbackFormData {
  activity: WorkoutActivitySelection
  moodBefore: MoodRating
  moodAfter: MoodRating
  difficulty: DifficultyPreference
  instructionPreference: InstructionPreference
  feedback?: string
  email?: string
  protocolVersion: string
}

/** What gets stored in MongoDB */
export interface WorkoutFeedbackSubmission extends WorkoutFeedbackFormData {
  _id?: string
  submittedAt: Date
  status: 'new' | 'reviewed' | 'responded' | 'closed'
  ipAddress?: string
  userAgent?: string
  adminNotes?: string
  updatedAt?: Date
}

/** API response shape */
export interface WorkoutFeedbackResponse {
  success: boolean
  message: string
  id?: string
  error?: string
  errors?: Partial<Record<keyof WorkoutFeedbackFormData, string>>
}

/** Stats shape for admin dashboard */
export interface WorkoutFeedbackStats {
  totalSubmissions: number
  newSubmissions: number
  avgMoodBefore: number
  avgMoodAfter: number
  avgMoodImprovement: number
  difficultyDistribution: Array<{ difficulty: string; count: number }>
  instructionPrefDistribution: Array<{ preference: string; count: number }>
  categoryDistribution: Array<{ category: string; count: number }>
  submissionsByDay: Array<{ date: string; count: number }>
}
