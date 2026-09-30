export type ScreenMode = 'LOGO' | 'ROUND' | 'QUESTION' | 'ANSWER' | 'LEADERBOARD' | 'CUSTOM' | 'PAUSE'

export interface QuizEvent {
  id: string
  name: string
  status: 'SETUP' | 'LIVE' | 'PAUSED' | 'FINISHED'
  registration_open: boolean
  current_round_id: string | null
  current_question_id: string | null
}

export interface Team {
  id: string
  event_id: string
  name: string
  score: number
  active: boolean
  created_at?: string
}

export interface TeamAccess {
  team_id: string
  team_name: string
  recovery_code: string
  active: boolean
}

export interface BuzzerWindow {
  id: string
  event_id: string
  question_id: string | null
  status: 'OPEN' | 'CLOSED'
  interaction_mode: 'BUZZER' | 'CHOICE'
  winner_team_id: string | null
  opened_at: string
  closed_at: string | null
}

export interface ScreenState {
  event_id: string
  mode: ScreenMode
  blackout: boolean
  title: string | null
  body: string | null
  options: unknown[]
  footer: string | null
  round_name: string | null
  source_question_id: string | null
  payload: Record<string, unknown>
  updated_at: string
}

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface RoundTemplate {
  id: string
  name: string
  description: string | null
  default_config: Record<string, unknown>
  sort_order: number
}

export interface QuizQuestion {
  id: string
  round_id: string
  category_id: string | null
  question_type: string
  prompt: string
  options: string[]
  clue_steps: string[]
  media_url: string | null
  metadata: Record<string, unknown>
  order_index: number
  answer_text: string | null
  answer_payload: Record<string, unknown>
  explanation: string | null
}

export interface QuizRound {
  id: string
  event_id: string
  template_id: string | null
  name: string
  order_index: number
  config: Record<string, unknown>
  active: boolean
  questions: QuizQuestion[]
}

export interface TeamSession {
  team_id: string
  team_name: string
  team_token: string
  recovery_code?: string
  event_id: string
}
