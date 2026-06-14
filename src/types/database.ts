export type ExerciseCategory = 'Push' | 'Pull' | 'Legs' | 'Core' | 'Other'
export type MovementType = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable'
export type WorkoutStatus = 'in_progress' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  display_name: string | null
  created_at: string
}

export interface Exercise {
  id: string
  user_id: string
  name: string
  category: ExerciseCategory
  movement_type: MovementType
  is_compound: boolean
  is_archived: boolean
  created_at: string
}

export interface Template {
  id: string
  user_id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TemplateExercise {
  id: string
  template_id: string
  exercise_id: string
  sort_order: number
  target_sets: number
  target_reps: number
  notes: string | null
  exercise?: Exercise
}

export interface TemplateWithExercises extends Template {
  template_exercises: TemplateExercise[]
}

export interface Workout {
  id: string
  user_id: string
  template_id: string
  started_at: string
  completed_at: string | null
  notes: string | null
  status: WorkoutStatus
  template?: Template
}

export interface WorkoutSet {
  id: string
  workout_id: string
  exercise_id: string
  set_number: number
  weight_kg: number
  reps: number
  rir: number
  is_warmup: boolean
  logged_at: string
  exercise?: Exercise
}

export interface LastPerformance {
  exercise_id: string
  weight_kg: number
  reps: number
  rir: number
  completed_at: string
  workout_id: string
}

export interface WorkoutWithSets extends Workout {
  workout_sets: WorkoutSet[]
}

export const BIG_LIFTS = [
  'Bench Press',
  'Back Squat',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
] as const
