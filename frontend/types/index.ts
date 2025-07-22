export interface VoiceMetrics {
  pace_wpm: number
  volume_consistency: number
  clarity_score: number
  voice_activity_ratio: number
  avg_volume: number
  avg_pitch: number
  pitch_variance: number
  spectral_centroid: number
  zero_crossing_rate: number
  duration: number
  estimated_words: number
}

export interface FeedbackItem {
  id: string
  type: FeedbackType
  severity: FeedbackSeverity
  message: string
  suggestion: string
  confidence: number
  timestamp: string
  audio_segment_start?: number
  audio_segment_end?: number
  detected_text?: string
}

export enum FeedbackType {
  VOICE_PACE = 'voice_pace',
  VOICE_VOLUME = 'voice_volume',
  VOICE_CLARITY = 'voice_clarity',
  FILLER_WORDS = 'filler_words',
  PAUSE_FREQUENCY = 'pause_frequency',
  STRUCTURE = 'structure',
  ENGAGEMENT = 'engagement',
  CONFIDENCE = 'confidence'
}

export enum FeedbackSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

export interface SessionConfig {
  session_type: SessionType
  language: string
  max_duration: number
  auto_pause_threshold: number
  feedback_frequency: number
  real_time_feedback: boolean
  detailed_analysis: boolean
  ai_coaching: boolean
  store_audio: boolean
  share_analytics: boolean
}

export enum SessionType {
  PRACTICE = 'practice',
  LIVE_COACHING = 'live_coaching',
  EVALUATION = 'evaluation',
  TRAINING = 'training'
}

export enum SessionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

export interface PresentationSession {
  id: string
  user_id: string
  config: SessionConfig
  status: SessionStatus
  created_at: string
  started_at?: string
  ended_at?: string
  expires_at?: string
  title?: string
  description?: string
  duration_seconds?: number
}

export interface SessionFeedback {
  session_id: string
  overall_score: number
  voice_metrics: VoiceMetrics
  feedback_items: FeedbackItem[]
  total_duration: number
  words_spoken: number
  effective_speaking_time: number
  strengths: string[]
  improvement_areas: string[]
  generated_at: string
  model_version: string
  processing_time_ms: number
}

export interface RealTimeFeedback {
  session_id: string
  chunk_id: string
  timestamp: string
  current_pace?: number
  current_volume?: number
  current_clarity?: number
  immediate_suggestions: string[]
  alerts: FeedbackItem[]
  session_progress: number
  improvement_trend?: string
}

export interface WebSocketMessage {
  type: string
  session_id?: string
  data?: any
  timestamp?: string
  error?: string
}

export interface AudioChunk {
  audio_data: string // base64 encoded
  timestamp: string
  sample_rate: number
  sequence_number: number
  duration?: number
}

export interface PerformanceMetric {
  session_id: string
  user_id?: string
  metric_type: string
  value: number
  timestamp: string
  session_type?: string
  presentation_topic?: string
  duration_seconds?: number
}

export interface UserAnalytics {
  user_id: string
  analysis_period: {
    start_date: string
    end_date: string
  }
  total_sessions: number
  total_practice_time: number
  average_session_duration: number
  current_metrics: Record<string, number>
  improvement_metrics: Record<string, number>
  best_scores: Record<string, number>
  strengths: string[]
  improvement_areas: string[]
  recommendations: string[]
  generated_at: string
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
  unlocked_at?: string
  progress?: number
  target?: number
}

export interface SessionSummary {
  session_id: string
  duration_seconds: number
  chunks_processed: number
  pipeline_stats: {
    chunks_processed: number
    analysis_time_ms: number
    feedback_time_ms: number
    metrics_time_ms: number
    total_pipeline_time_ms: number
    errors_count: number
    success_rate: number
  }
  processing_efficiency: number
  average_chunk_time_ms: number
  total_processing_time_ms: number
  error_rate: number
  session_end_timestamp: string
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface PaginatedResponse<T = any> {
  items: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}