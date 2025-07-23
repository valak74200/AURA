import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { 
  Session, 
  CreateSessionRequest, 
  SessionsQuery, 
  SessionsResponse,
  SessionFeedbackResponse, 
  SessionAnalyticsResponse,
  AudioAnalysisResult, 
  ApiError,
  User
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Configure axios-retry for automatic retries
    axiosRetry(this.api, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        // Retry on network errors or 5xx status codes, but not 4xx (client errors)
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response?.status ?? 0) >= 500;
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.log(`Retry attempt ${retryCount} for ${requestConfig.url}`);
      }
    });

    // Request interceptor for auth
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.log('API Error Response:', error.response?.data);
        
        let errorMessage = 'Unknown error';
        
        // Handle FastAPI validation errors (422)
        if (error.response?.data?.detail && Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail
            .map((err: any) => err.msg || err.message || JSON.stringify(err))
            .join(', ');
        } else if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        const apiError: ApiError = {
          message: errorMessage,
          status: error.response?.status || 500,
          code: error.response?.data?.code,
        };
        return Promise.reject(apiError);
      }
    );
  }

  // Session Management
  async createSession(data: CreateSessionRequest): Promise<Session> {
    const response: AxiosResponse<Session> = await this.api.post('/sessions', data);
    return response.data;
  }

  async getSession(id: string): Promise<Session> {
    const response: AxiosResponse<Session> = await this.api.get(`/sessions/${id}`);
    return response.data;
  }

  async getSessions(query?: SessionsQuery): Promise<SessionsResponse> {
    const params = new URLSearchParams();
    if (query?.user_id) params.append('user_id', query.user_id);
    if (query?.status) params.append('status_filter', query.status);
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());
    if (query?.sort_by) params.append('sort_by', query.sort_by);
    if (query?.sort_order) params.append('sort_order', query.sort_order);

    const response: AxiosResponse<SessionsResponse> = await this.api.get(`/sessions?${params.toString()}`);
    return response.data;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    const response: AxiosResponse<Session> = await this.api.put(`/sessions/${id}`, updates);
    return response.data;
  }

  async deleteSession(id: string): Promise<void> {
    await this.api.delete(`/sessions/${id}`);
  }

  // Audio Processing
  async uploadAudio(
    sessionId: string, 
    file: File, 
    options?: { processImmediately?: boolean; generateFeedback?: boolean }
  ): Promise<AudioAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options?.processImmediately !== undefined) {
      formData.append('process_immediately', options.processImmediately.toString());
    }
    if (options?.generateFeedback !== undefined) {
      formData.append('generate_feedback', options.generateFeedback.toString());
    }

    const response: AxiosResponse<AudioAnalysisResult> = await this.api.post(
      `/sessions/${sessionId}/audio/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  async analyzeAudioChunk(sessionId: string, audioData: {
    audio_array: number[];
    sample_rate: number;
    duration: number;
  }): Promise<any> {
    const response = await this.api.post(`/sessions/${sessionId}/audio/analyze`, audioData);
    return response.data;
  }

  // Feedback & Analytics
  async getSessionFeedback(
    sessionId: string,
    options?: { feedback_type?: string; limit?: number; offset?: number }
  ): Promise<SessionFeedbackResponse> {
    const params = new URLSearchParams();
    if (options?.feedback_type) params.append('feedback_type', options.feedback_type);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response: AxiosResponse<SessionFeedbackResponse> = await this.api.get(
      `/sessions/${sessionId}/feedback?${params.toString()}`
    );
    return response.data;
  }

  async generateCustomFeedback(sessionId: string, request: {
    analysis_type?: string;
    focus_areas?: string[];
    custom_prompt?: string;
  }): Promise<{ feedback: any }> {
    const response = await this.api.post(`/sessions/${sessionId}/feedback/generate`, request);
    return response.data;
  }

  async getSessionAnalytics(
    sessionId: string,
    options?: { include_trends?: boolean; include_benchmarks?: boolean }
  ): Promise<SessionAnalyticsResponse> {
    const params = new URLSearchParams();
    if (options?.include_trends !== undefined) {
      params.append('include_trends', options.include_trends.toString());
    }
    if (options?.include_benchmarks !== undefined) {
      params.append('include_benchmarks', options.include_benchmarks.toString());
    }

    const response: AxiosResponse<SessionAnalyticsResponse> = await this.api.get(
      `/sessions/${sessionId}/analytics?${params.toString()}`
    );
    return response.data;
  }

  // System Health
  async healthCheck(): Promise<{ status: string; services: Record<string, string> }> {
    const response = await this.api.get('/health');
    return response.data;
  }

  async testServices(): Promise<{ tests: Record<string, string>; overall_status: string }> {
    const response = await this.api.get('/test');
    return response.data;
  }

  // Authentication (if implemented) 
  async login(credentials: { email_or_username: string; password: string }): Promise<{ token: string; user: User }> {
    const response = await this.api.post('/auth/login', credentials);
    // Le backend renvoie access_token, on le transforme en token
    return {
      token: response.data.access_token,
      user: response.data.user
    };
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout');
  }

  async register(userData: { username: string; email: string; password: string; confirm_password: string }): Promise<{ token: string; user: User }> {
    await this.api.post('/auth/register', userData);
    // Le backend ne renvoie que l'utilisateur, pas de token
    // Il faut se connecter après l'inscription
    const loginResponse = await this.login({
      email_or_username: userData.username,
      password: userData.password
    });
    return loginResponse;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;