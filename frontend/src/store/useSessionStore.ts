import { create } from 'zustand';
import { Session, SessionStatus, CoachingResult, RealtimeFeedback, MultilangualMetrics } from '../types';
import webSocketService from '../services/websocket';

interface SessionStore {
  // Current session state
  currentSession: Session | null;
  sessionStatus: SessionStatus | null;
  isRecording: boolean;
  isConnected: boolean;

  // Real-time data
  realtimeFeedback: RealtimeFeedback[];
  coachingResults: CoachingResult[];
  currentMetrics: MultilangualMetrics | null;

  // Audio state
  audioLevel: number;
  isProcessing: boolean;

  // Actions
  setCurrentSession: (session: Session | null) => void;
  setSessionStatus: (status: SessionStatus) => void;
  setRecording: (recording: boolean) => void;
  setConnected: (connected: boolean) => void;
  
  addRealtimeFeedback: (feedback: RealtimeFeedback) => void;
  addCoachingResult: (result: CoachingResult) => void;
  setCurrentMetrics: (metrics: MultilangualMetrics) => void;
  
  setAudioLevel: (level: number) => void;
  setProcessing: (processing: boolean) => void;
  
  clearSessionData: () => void;
  connectWebSocket: (sessionId: string) => Promise<void>;
  disconnectWebSocket: () => void;
  sendAudioChunk: (audioData: string, sampleRate: number) => boolean;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  currentSession: null,
  sessionStatus: null,
  isRecording: false,
  isConnected: false,

  realtimeFeedback: [],
  coachingResults: [],
  currentMetrics: null,

  audioLevel: 0,
  isProcessing: false,

  // Actions
  setCurrentSession: (session) => set({ currentSession: session }),
  
  setSessionStatus: (status) => set({ sessionStatus: status }),
  
  setRecording: (recording) => set({ isRecording: recording }),
  
  setConnected: (connected) => set({ isConnected: connected }),

  addRealtimeFeedback: (feedback) => {
    set((state) => ({
      realtimeFeedback: [...state.realtimeFeedback.slice(-19), feedback], // Keep last 20
    }));
  },

  addCoachingResult: (result) => {
    set((state) => ({
      coachingResults: [...state.coachingResults.slice(-49), result], // Keep last 50
    }));
  },

  setCurrentMetrics: (metrics) => set({ currentMetrics: metrics }),

  setAudioLevel: (level) => set({ audioLevel: level }),

  setProcessing: (processing) => set({ isProcessing: processing }),

  clearSessionData: () => {
    set({
      realtimeFeedback: [],
      coachingResults: [],
      currentMetrics: null,
      audioLevel: 0,
      isProcessing: false,
    });
  },

  connectWebSocket: async (sessionId: string) => {
    const { setConnected, addRealtimeFeedback, addCoachingResult } = get();
    
    try {
      await webSocketService.connect(sessionId, {
        onOpen: () => {
          setConnected(true);
          console.log('WebSocket connected for session:', sessionId);
        },
        
        onClose: () => {
          setConnected(false);
          console.log('WebSocket disconnected');
        },
        
        onError: (error) => {
          console.error('WebSocket error:', error);
          setConnected(false);
        },
        
        onRealtimeFeedback: (feedback) => {
          addRealtimeFeedback(feedback);
        },
        
        onCoachingResult: (result) => {
          addCoachingResult(result);
        },
        
        onMilestoneAchieved: (milestone) => {
          console.log('Milestone achieved:', milestone);
          // You could add a separate milestone store or handle it here
        },

        onMessage: (message) => {
          console.log('WebSocket message received:', message);
          
          // Handle different message types
          switch (message.type) {
            case 'coaching_feedback':
              console.log('Coaching feedback received:', message.data);
              if (message.data) {
                // Extract detailed feedback information
                const voiceAnalysis = message.data.voice_analysis || {};
                const coachingFeedback = message.data.coaching_feedback || {};
                const aiGeneratedFeedback = coachingFeedback.ai_generated_feedback || {};
                const realtimeInsights = message.data.real_time_insights || {};
                
                // Create detailed message from available data
                let detailedMessage = 'Feedback reçu';
                if (aiGeneratedFeedback.feedback_summary) {
                  detailedMessage = aiGeneratedFeedback.feedback_summary;
                } else if (realtimeInsights.encouragement) {
                  detailedMessage = realtimeInsights.encouragement;
                } else if (voiceAnalysis.chunk_metrics) {
                  const metrics = voiceAnalysis.chunk_metrics;
                  detailedMessage = `Analyse vocale - Volume: ${metrics.volume_level?.toFixed(1) || 'N/A'}, Clarté: ${metrics.clarity_score?.toFixed(2) || 'N/A'}`;
                }
                
                const coachingResult: CoachingResult = {
                  type: 'coaching_result',
                  result_type: 'coaching_feedback',
                  message: detailedMessage,
                  session_id: message.session_id || '',
                  chunk_id: message.data.chunk_id || '',
                  voice_analysis: message.data.voice_analysis,
                  coaching_feedback: message.data.coaching_feedback,
                  performance_metrics: message.data.performance_metrics,
                  timestamp: message.timestamp || new Date().toISOString()
                };
                addCoachingResult(coachingResult);
                
                // Also add real-time insights if available
                if (realtimeInsights.immediate_suggestions && Array.isArray(realtimeInsights.immediate_suggestions)) {
                  realtimeInsights.immediate_suggestions.forEach((suggestion: string, index: number) => {
                    const realtimeFeedback: RealtimeFeedback = {
                      type: 'realtime_feedback',
                      feedback_type: 'suggestion',
                      message: suggestion,
                      confidence: 0.8,
                      session_id: message.session_id || '',
                      timestamp: message.timestamp || new Date().toISOString()
                    };
                    addRealtimeFeedback(realtimeFeedback);
                  });
                }
                
                // Add AI feedback improvements as real-time suggestions
                if (aiGeneratedFeedback.improvements && Array.isArray(aiGeneratedFeedback.improvements)) {
                  aiGeneratedFeedback.improvements.slice(0, 2).forEach((improvement: any) => {
                    const realtimeFeedback: RealtimeFeedback = {
                      type: 'realtime_feedback',
                      feedback_type: 'improvement',
                      message: improvement.actionable_tip || improvement.area || 'Conseil d\'amélioration',
                      confidence: 0.9,
                      session_id: message.session_id || '',
                      timestamp: message.timestamp || new Date().toISOString()
                    };
                    addRealtimeFeedback(realtimeFeedback);
                  });
                }
              }
              break;
              
            case 'realtime_suggestion':
              console.log('Realtime suggestion received:', message.data);
              if (message.data?.suggestions) {
                message.data.suggestions.forEach((suggestion: any) => {
                  const realtimeFeedback: RealtimeFeedback = {
                    type: 'realtime_feedback',
                    feedback_type: suggestion.type || 'suggestion',
                    message: suggestion.message || 'Suggestion reçue',
                    confidence: 0.8,
                    session_id: message.session_id || '',
                    timestamp: message.timestamp || new Date().toISOString()
                  };
                  addRealtimeFeedback(realtimeFeedback);
                });
              }
              break;
              
            case 'performance_metrics':
              console.log('Performance metrics received:', message.data);
              // Handle performance metrics if needed
              break;
              
            case 'session_initialized':
              console.log('Session initialized:', message.message);
              break;
              
            case 'audio_processing_error':
              console.error('Audio processing error:', message.error);
              break;
              
            default:
              console.log('Unknown message type:', message.type, message);
          }
        },
      });
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnected(false);
      throw error;
    }
  },

  disconnectWebSocket: () => {
    webSocketService.disconnect();
    set({ isConnected: false });
  },

  sendAudioChunk: (audioData: string, sampleRate: number = 16000): boolean => {
    return webSocketService.sendAudioChunk(audioData, sampleRate);
  },
}));