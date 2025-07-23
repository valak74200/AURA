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
}));