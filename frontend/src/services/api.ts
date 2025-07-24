import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
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

// Enhanced error types for better error handling
export const ErrorType = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  CIRCUIT_BREAKER_ERROR: 'CIRCUIT_BREAKER_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

export interface EnhancedApiError extends ApiError {
  type: ErrorType;
  retryable: boolean;
  timestamp: string;
  requestId?: string;
  details?: any;
  suggestions?: string[];
}

// Circuit breaker implementation for frontend
class FrontendCircuitBreaker {
  private failures: number;
  private lastFailureTime: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  private failureThreshold: number;
  private recoveryTimeout: number;
  private name: string;
  
  constructor(
    failureThreshold: number = 5,
    recoveryTimeout: number = 30000, // 30 seconds
    name: string = 'api'
  ) {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.name = name;
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`Circuit breaker ${this.name} is now OPEN`);
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

class ApiService {
  private api: AxiosInstance;
  private circuitBreaker: FrontendCircuitBreaker;
  private requestQueue: Map<string, Promise<any>> = new Map();

  constructor() {
    this.circuitBreaker = new FrontendCircuitBreaker(5, 30000, 'api-service');
    
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Configure enhanced axios-retry
    axiosRetry(this.api, {
      retries: 3,
      retryDelay: (retryCount, error) => {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, retryCount) * 1000;
        const jitter = Math.random() * 1000;
        return baseDelay + jitter;
      },
      retryCondition: (error) => {
        const status = error.response?.status;
        // Retry on network errors, timeouts, and specific server errors
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               status === 429 || // Rate limit
               status === 502 || // Bad Gateway
               status === 503 || // Service Unavailable
               status === 504;   // Gateway Timeout
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.log(`Retry attempt ${retryCount} for ${requestConfig.url}`, {
          status: error.response?.status,
          message: error.message
        });
      }
    });

    // Request interceptor for auth and request deduplication
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Add request ID for tracking
      config.headers['X-Request-ID'] = this.generateRequestId();
      
      return config;
    });

    // Enhanced response interceptor for comprehensive error handling
    this.api.interceptors.response.use(
      (response) => {
        // Log successful responses in development
        if (import.meta.env.DEV) {
          console.log(`✅ API Success: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            requestId: response.config.headers['X-Request-ID']
          });
        }
        return response;
      },
      (error: AxiosError) => {
        const enhancedError = this.createEnhancedError(error);
        
        // Log error details
        console.error('🚨 API Error:', {
          type: enhancedError.type,
          message: enhancedError.message,
          status: enhancedError.status,
          url: error.config?.url,
          requestId: error.config?.headers?.['X-Request-ID'],
          retryable: enhancedError.retryable
        });
        
        // Handle specific error types
        this.handleSpecificErrors(enhancedError);
        
        return Promise.reject(enhancedError);
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createEnhancedError(error: AxiosError): EnhancedApiError {
    const status = error.response?.status || 0;
    const responseData = error.response?.data as any;
    
    let errorType: ErrorType;
    let retryable = false;
    let suggestions: string[] = [];
    
    // Categorize error types
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorType = ErrorType.TIMEOUT_ERROR;
      retryable = true;
      suggestions.push('The request timed out. Please try again.');
    } else if (error.code === 'ERR_NETWORK' || !error.response) {
      errorType = ErrorType.NETWORK_ERROR;
      retryable = true;
      suggestions.push('Network connection issue. Check your internet connection.');
    } else if (status === 401) {
      errorType = ErrorType.AUTHENTICATION_ERROR;
      retryable = false;
      suggestions.push('Please log in again.');
    } else if (status === 403) {
      errorType = ErrorType.AUTHORIZATION_ERROR;
      retryable = false;
      suggestions.push('You do not have permission to perform this action.');
    } else if (status === 422) {
      errorType = ErrorType.VALIDATION_ERROR;
      retryable = false;
      suggestions.push('Please check your input data.');
    } else if (status === 429) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
      retryable = true;
      suggestions.push('Too many requests. Please wait a moment before trying again.');
    } else if (status >= 500) {
      errorType = ErrorType.SERVER_ERROR;
      retryable = true;
      suggestions.push('Server error. Please try again later.');
    } else {
      errorType = ErrorType.UNKNOWN_ERROR;
      retryable = false;
    }

    // Extract error message
    let errorMessage = 'Unknown error occurred';
    if (responseData?.detail && Array.isArray(responseData.detail)) {
      errorMessage = responseData.detail
        .map((err: any) => err.msg || err.message || JSON.stringify(err))
        .join(', ');
    } else if (responseData?.detail) {
      errorMessage = responseData.detail;
    } else if (responseData?.message) {
      errorMessage = responseData.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      message: errorMessage,
      status,
      code: responseData?.code,
      type: errorType,
      retryable,
      timestamp: new Date().toISOString(),
      requestId: error.config?.headers?.['X-Request-ID'],
      details: responseData,
      suggestions
    };
  }

  private handleSpecificErrors(error: EnhancedApiError): void {
    switch (error.type) {
      case ErrorType.AUTHENTICATION_ERROR:
        // Clear auth token and redirect to login
        localStorage.removeItem('auth_token');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
        break;
        
      case ErrorType.RATE_LIMIT_ERROR:
        // Implement exponential backoff
        const retryAfter = error.details?.retry_after || 60;
        console.warn(`Rate limited. Retry after ${retryAfter} seconds`);
        break;
        
      case ErrorType.CIRCUIT_BREAKER_ERROR:
        // Circuit breaker is open, show appropriate message
        console.warn('Service temporarily unavailable due to circuit breaker');
        break;
    }
  }

  // Enhanced request wrapper with circuit breaker and deduplication
  private async makeRequest<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    options: {
      deduplicate?: boolean;
      deduplicationKey?: string;
      bypassCircuitBreaker?: boolean;
    } = {}
  ): Promise<T> {
    const { deduplicate = false, deduplicationKey, bypassCircuitBreaker = false } = options;
    
    // Request deduplication
    if (deduplicate && deduplicationKey) {
      const existingRequest = this.requestQueue.get(deduplicationKey);
      if (existingRequest) {
        return existingRequest;
      }
    }

    const executeRequest = async (): Promise<T> => {
      try {
        if (bypassCircuitBreaker) {
          const response = await requestFn();
          return response.data;
        } else {
          const response = await this.circuitBreaker.execute(requestFn);
          return response.data;
        }
      } catch (error) {
        // If circuit breaker is open, create appropriate error
        if (error instanceof Error && error.message.includes('Circuit breaker')) {
          const circuitBreakerError: EnhancedApiError = {
            message: 'Service temporarily unavailable',
            status: 503,
            type: ErrorType.CIRCUIT_BREAKER_ERROR,
            retryable: true,
            timestamp: new Date().toISOString(),
            suggestions: ['The service is temporarily unavailable. Please try again in a few moments.']
          };
          throw circuitBreakerError;
        }
        throw error;
      }
    };

    // Execute request with optional deduplication
    if (deduplicate && deduplicationKey) {
      const requestPromise = executeRequest();
      this.requestQueue.set(deduplicationKey, requestPromise);
      
      try {
        const result = await requestPromise;
        this.requestQueue.delete(deduplicationKey);
        return result;
      } catch (error) {
        this.requestQueue.delete(deduplicationKey);
        throw error;
      }
    } else {
      return executeRequest();
    }
  }

  // Get circuit breaker status for monitoring
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getState();
  }

  // Session Management
  async createSession(data: CreateSessionRequest): Promise<Session> {
    return this.makeRequest(
      () => this.api.post<Session>('/sessions', data),
      { deduplicate: false }
    );
  }

  async getSession(id: string): Promise<Session> {
    return this.makeRequest(
      () => this.api.get<Session>(`/sessions/${id}`),
      {
        deduplicate: true,
        deduplicationKey: `get-session-${id}`
      }
    );
  }

  async getSessions(query?: SessionsQuery): Promise<SessionsResponse> {
    const params = new URLSearchParams();
    if (query?.user_id) params.append('user_id', query.user_id);
    if (query?.status) params.append('status_filter', query.status);
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());
    if (query?.sort_by) params.append('sort_by', query.sort_by);
    if (query?.sort_order) params.append('sort_order', query.sort_order);

    const queryString = params.toString();
    return this.makeRequest(
      () => this.api.get<SessionsResponse>(`/sessions?${queryString}`),
      {
        deduplicate: true,
        deduplicationKey: `get-sessions-${queryString}`
      }
    );
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    return this.makeRequest(
      () => this.api.put<Session>(`/sessions/${id}`, updates),
      { deduplicate: false }
    );
  }

  async deleteSession(id: string): Promise<void> {
    await this.makeRequest(
      () => this.api.delete(`/sessions/${id}`),
      { deduplicate: false }
    );
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

    return this.makeRequest(
      () => this.api.post<AudioAnalysisResult>(
        `/sessions/${sessionId}/audio/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      ),
      {
        deduplicate: false, // Audio uploads should not be deduplicated
        bypassCircuitBreaker: false // Audio processing is critical, use circuit breaker
      }
    );
  }

  async analyzeAudioChunk(sessionId: string, audioData: {
    audio_array: number[];
    sample_rate: number;
    duration: number;
  }): Promise<any> {
    return this.makeRequest(
      () => this.api.post(`/sessions/${sessionId}/audio/analyze`, audioData),
      {
        deduplicate: false, // Real-time audio analysis should not be deduplicated
        bypassCircuitBreaker: false // Use circuit breaker for resilience
      }
    );
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

    const queryString = params.toString();
    return this.makeRequest(
      () => this.api.get<SessionFeedbackResponse>(`/sessions/${sessionId}/feedback?${queryString}`),
      {
        deduplicate: true,
        deduplicationKey: `get-feedback-${sessionId}-${queryString}`
      }
    );
  }

  async generateCustomFeedback(sessionId: string, request: {
    analysis_type?: string;
    focus_areas?: string[];
    custom_prompt?: string;
  }): Promise<{ feedback: any }> {
    return this.makeRequest(
      () => this.api.post<{ feedback: any }>(`/sessions/${sessionId}/feedback/generate`, request),
      {
        deduplicate: false, // Custom feedback generation should not be deduplicated
        bypassCircuitBreaker: false // Use circuit breaker for AI operations
      }
    );
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

    const queryString = params.toString();
    return this.makeRequest(
      () => this.api.get<SessionAnalyticsResponse>(`/sessions/${sessionId}/analytics?${queryString}`),
      {
        deduplicate: true,
        deduplicationKey: `get-analytics-${sessionId}-${queryString}`
      }
    );
  }

  // System Health
  async healthCheck(): Promise<{ status: string; services: Record<string, string> }> {
    return this.makeRequest(
      () => this.api.get<{ status: string; services: Record<string, string> }>('/health'),
      {
        deduplicate: true,
        deduplicationKey: 'health-check',
        bypassCircuitBreaker: true // Health checks should bypass circuit breaker
      }
    );
  }

  async testServices(): Promise<{ tests: Record<string, string>; overall_status: string }> {
    return this.makeRequest(
      () => this.api.get<{ tests: Record<string, string>; overall_status: string }>('/test'),
      {
        deduplicate: true,
        deduplicationKey: 'test-services',
        bypassCircuitBreaker: true // Service tests should bypass circuit breaker
      }
    );
  }

  // Authentication (if implemented)
  async login(credentials: { email_or_username: string; password: string }): Promise<{ token: string; user: User }> {
    const response = await this.makeRequest(
      () => this.api.post<{ access_token: string; user: User }>('/auth/login', credentials),
      {
        deduplicate: false, // Login should not be deduplicated
        bypassCircuitBreaker: true // Authentication is critical, bypass circuit breaker
      }
    );
    
    // Transform backend response format
    return {
      token: response.access_token,
      user: response.user
    };
  }

  async logout(): Promise<void> {
    await this.makeRequest(
      () => this.api.post('/auth/logout'),
      {
        deduplicate: false,
        bypassCircuitBreaker: true // Logout should always work
      }
    );
  }

  async register(userData: { username: string; email: string; password: string; confirm_password: string }): Promise<{ token: string; user: User }> {
    await this.makeRequest(
      () => this.api.post('/auth/register', userData),
      {
        deduplicate: false,
        bypassCircuitBreaker: true // Registration is critical
      }
    );
    
    // Backend doesn't return token, need to login after registration
    const loginResponse = await this.login({
      email_or_username: userData.username,
      password: userData.password
    });
    return loginResponse;
  }

  async getCurrentUser(): Promise<User> {
    return this.makeRequest(
      () => this.api.get<User>('/auth/me'),
      {
        deduplicate: true,
        deduplicationKey: 'current-user'
      }
    );
  }
}

export const apiService = new ApiService();
export default apiService;