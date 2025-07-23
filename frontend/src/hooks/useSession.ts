import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Session, 
  CreateSessionRequest, 
  SessionsQuery, 
  SessionFeedbackResponse, 
  SessionAnalyticsResponse,
  SessionsResponse 
} from '../types';
import apiService from '../services/api';

// Query keys
export const sessionKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionKeys.all, 'list'] as const,
  list: (filters: SessionsQuery) => [...sessionKeys.lists(), { filters }] as const,
  details: () => [...sessionKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionKeys.details(), id] as const,
  feedback: (id: string) => [...sessionKeys.detail(id), 'feedback'] as const,
  analytics: (id: string) => [...sessionKeys.detail(id), 'analytics'] as const,
};

// Sessions list query
export function useSessions(query?: SessionsQuery) {
  return useQuery({
    queryKey: sessionKeys.list(query || {}),
    queryFn: () => apiService.getSessions(query),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Single session query
export function useSession(id: string, enabled = true) {
  return useQuery({
    queryKey: sessionKeys.detail(id),
    queryFn: () => apiService.getSession(id),
    enabled: !!id && enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Session feedback query
export function useSessionFeedback(
  sessionId: string, 
  options?: { feedback_type?: string; limit?: number; offset?: number },
  enabled = true
) {
  return useQuery({
    queryKey: [...sessionKeys.feedback(sessionId), options],
    queryFn: () => apiService.getSessionFeedback(sessionId, options),
    enabled: !!sessionId && enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Session analytics query
export function useSessionAnalytics(
  sessionId: string,
  options?: { include_trends?: boolean; include_benchmarks?: boolean },
  enabled = true
) {
  return useQuery({
    queryKey: [...sessionKeys.analytics(sessionId), options],
    queryFn: () => apiService.getSessionAnalytics(sessionId, options),
    enabled: !!sessionId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Create session mutation
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSessionRequest) => apiService.createSession(data),
    onSuccess: (newSession) => {
      // Invalidate sessions list
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      
      // Add the new session to cache
      queryClient.setQueryData(sessionKeys.detail(newSession.id), newSession);
    },
  });
}

// Update session mutation
export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Session> }) => 
      apiService.updateSession(id, updates),
    onSuccess: (updatedSession) => {
      // Update the session in cache
      queryClient.setQueryData(sessionKeys.detail(updatedSession.id), updatedSession);
      
      // Invalidate sessions list to reflect changes
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
  });
}

// Delete session mutation
export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiService.deleteSession(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: sessionKeys.detail(deletedId) });
      
      // Invalidate sessions list
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
  });
}

// Upload audio mutation
export function useUploadAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      sessionId, 
      file, 
      options 
    }: { 
      sessionId: string; 
      file: File; 
      options?: { processImmediately?: boolean; generateFeedback?: boolean } 
    }) => apiService.uploadAudio(sessionId, file, options),
    onSuccess: (_, { sessionId }) => {
      // Invalidate session feedback and analytics
      queryClient.invalidateQueries({ queryKey: sessionKeys.feedback(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionKeys.analytics(sessionId) });
    },
  });
}

// Generate custom feedback mutation
export function useGenerateCustomFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      sessionId, 
      request 
    }: { 
      sessionId: string; 
      request: { analysis_type?: string; focus_areas?: string[]; custom_prompt?: string } 
    }) => apiService.generateCustomFeedback(sessionId, request),
    onSuccess: (_, { sessionId }) => {
      // Invalidate session feedback
      queryClient.invalidateQueries({ queryKey: sessionKeys.feedback(sessionId) });
    },
  });
}

// Analyze audio chunk mutation (for real-time)
export function useAnalyzeAudioChunk() {
  return useMutation({
    mutationFn: ({ 
      sessionId, 
      audioData 
    }: { 
      sessionId: string; 
      audioData: { audio_array: number[]; sample_rate: number; duration: number } 
    }) => apiService.analyzeAudioChunk(sessionId, audioData),
  });
}