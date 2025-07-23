// Base types matching backend models
export type SupportedLanguage = 'fr' | 'en';

export type SessionType = 'presentation' | 'conversation' | 'pronunciation' | 'reading';

export type SessionStatus = 'active' | 'completed' | 'paused' | 'created';

export type SessionDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface SessionConfig {
  realtime_feedback?: boolean;
  auto_transcription?: boolean;
  voice_analysis?: boolean;
  difficulty?: SessionDifficulty;
  focus_areas?: string[];
  duration_target?: number;
  custom_prompt?: string;
}

export interface Session {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  session_type: SessionType;
  language: SupportedLanguage;
  status: SessionStatus;
  config: SessionConfig;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  duration?: number;
}

export interface CreateSessionRequest {
  title: string;
  description?: string;
  session_type: SessionType;
  language: SupportedLanguage;
  difficulty: SessionDifficulty;
  duration_target: number;
  focus_areas?: string[];
  custom_prompt?: string;
  config?: SessionConfig;
}

export interface VoiceMetrics {
  duration: number;
  avg_volume: number;
  pace_wpm: number;
  clarity_score: number;
  pitch_variance: number;
  volume_consistency: number;
  voice_activity_ratio: number;
}

export interface AudioAnalysisResult {
  status: string;
  filename: string;
  processing_time_ms: number;
  voice_metrics: VoiceMetrics;
  quality_indicators: {
    overall_quality: number;
    volume_quality: number;
    clarity_quality: number;
    pace_quality: number;
  };
}

export interface FeedbackItem {
  type: 'volume' | 'pace' | 'clarity' | 'cultural_adaptation';
  category: 'technique' | 'delivery' | 'content' | 'cultural';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  score: number;
  suggestions: string[];
  cultural_context?: string;
}

export interface SessionFeedback {
  id: string;
  session_id: string;
  feedback_type: string;
  content: string;
  score?: number;
  created_at: string;
}

export interface SessionFeedbackResponse {
  data: SessionFeedback[];
  total: number;
  page: number;
  limit: number;
}

export interface MultilangualMetrics {
  language: SupportedLanguage;
  core_metrics: {
    pace: {
      wpm: number;
      optimal_wpm: number;
      score: number;
      feedback: string;
    };
    volume: {
      level: number;
      target_level: number;
      score: number;
    };
    clarity: {
      raw_score: number;
      adjusted_score: number;
      weight_applied: number;
    };
    pitch_variation: {
      actual_variance: number;
      expected_variance: number;
      ratio: number;
      score: number;
    };
  };
  cultural_metrics: {
    cultural_adaptation_score: number;
    cultural_factors: {
      formality_level: number;
      engagement_style: number;
      directness_level: number;
      emotional_expression: number;
    };
  };
  benchmark_comparison: {
    overall_percentile: number;
    strengths: string[];
    improvement_areas: string[];
  };
  language_insights: Array<{
    type: string;
    level: string;
    title: string;
    message: string;
    action: string;
  }>;
  overall_language_score: {
    overall_score: number;
    percentage: number;
    grade: string;
    performance_level: string;
  };
}

export interface WebSocketMessage {
  type: 'audio_chunk' | 'coaching_result' | 'realtime_feedback' | 'milestone_achieved' | 'error';
  data?: any;
  session_id?: string;
  timestamp?: string;
}

export interface AudioChunkMessage {
  type: 'audio_chunk';
  audio_data: string; // base64 encoded
  sample_rate: number;
  timestamp: string;
}

export interface CoachingResult {
  type: 'coaching_result';
  result_type: string;
  message: string;
  score?: number;
  session_id: string;
  chunk_id: string;
  voice_analysis?: any;
  coaching_feedback?: any;
  performance_metrics?: any;
  timestamp: string;
}

export interface RealtimeFeedback {
  type: 'realtime_feedback';
  feedback_type: string;
  message: string;
  confidence?: number;
  session_id: string;
  timestamp: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
  preferences?: {
    language: SupportedLanguage;
    theme: 'light' | 'dark';
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

// UI Component Props
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

// Error types
export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// Query and mutation types for React Query
export interface SessionsQuery {
  user_id?: string;
  status?: SessionStatus;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface SessionsResponse {
  data: Session[];
  total: number;
  page: number;
  limit: number;
}

export interface SessionAnalyticsResponse {
  session_id: string;
  language: SupportedLanguage;
  overall_metrics: MultilangualMetrics;
  recommendations?: Array<{
    title: string;
    description: string;
    priority: string;
  }>;
}