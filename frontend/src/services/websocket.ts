import { WebSocketMessage, AudioChunkMessage, CoachingResult, RealtimeFeedback } from '../types';

export type WebSocketEventType = 'open' | 'close' | 'error' | 'message' | 'coaching_result' | 'realtime_feedback' | 'milestone_achieved';

export interface WebSocketEventHandlers {
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onCoachingResult?: (result: CoachingResult) => void;
  onRealtimeFeedback?: (feedback: RealtimeFeedback) => void;
  onMilestoneAchieved?: (milestone: any) => void;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // Start with 1 second
  private handlers: WebSocketEventHandlers = {};
  private sessionId: string | null = null;
  private isReconnecting = false;

  constructor() {
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.send = this.send.bind(this);
  }

  connect(sessionId: string, handlers: WebSocketEventHandlers = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.sessionId = sessionId;
      this.handlers = handlers;

      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
      const url = `${wsUrl}/ws/session/${sessionId}`;

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('WebSocket connected to session:', sessionId);
          this.reconnectAttempts = 0;
          this.reconnectInterval = 1000;
          this.isReconnecting = false;
          this.handlers.onOpen?.();
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.reason);
          this.handlers.onClose?.(event);
          
          if (!this.isReconnecting && this.shouldReconnect(event)) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.handlers.onError?.(error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  private handleMessage(message: WebSocketMessage): void {
    this.handlers.onMessage?.(message);

    switch (message.type) {
      case 'coaching_result':
        this.handlers.onCoachingResult?.(message as CoachingResult);
        break;
      case 'realtime_feedback':
        this.handlers.onRealtimeFeedback?.(message as RealtimeFeedback);
        break;
      case 'milestone_achieved':
        this.handlers.onMilestoneAchieved?.(message);
        break;
      case 'error':
        console.error('WebSocket error message:', message.data);
        break;
    }
  }

  private shouldReconnect(event: CloseEvent): boolean {
    // Don't reconnect if it was a manual close or if we've exceeded max attempts
    return !event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts;
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.reconnectAttempts++;

    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId, this.handlers)
          .catch(() => {
            // Exponential backoff
            this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.scheduleReconnect();
            } else {
              console.error('Max reconnection attempts reached');
              this.isReconnecting = false;
            }
          });
      }
    }, this.reconnectInterval);
  }

  send(message: WebSocketMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message);
        console.log('Sending WebSocket message:', {
          type: message.type,
          messageLength: messageStr.length,
          websocketState: this.ws.readyState
        });
        this.ws.send(messageStr);
        return true;
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        return false;
      }
    }
    console.warn('WebSocket is not connected, state:', this.ws?.readyState);
    return false;
  }

  sendAudioChunk(audioData: string, sampleRate: number = 16000): boolean {
    const message: AudioChunkMessage = {
      type: 'audio_chunk',
      audio_data: audioData,
      sample_rate: sampleRate,
      timestamp: new Date().toISOString(),
    };
    
    console.log('Sending audio chunk via WebSocket:', {
      type: message.type,
      audioDataLength: audioData.length,
      sampleRate: sampleRate,
      timestamp: message.timestamp
    });
    
    const success = this.send(message as unknown as WebSocketMessage);
    if (!success) {
      console.error('Failed to send audio chunk - WebSocket not connected');
    }
    return success;
  }

  sendControlMessage(action: 'start' | 'stop' | 'pause' | 'resume'): boolean {
    const message: WebSocketMessage = {
      type: 'audio_chunk', // Using existing type for now
      data: { action },
      timestamp: new Date().toISOString(),
    };
    return this.send(message);
  }

  disconnect(): void {
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  getConnectionState(): string {
    if (!this.ws) return 'CLOSED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;