import { useRef, useCallback, useEffect, useState } from "react";
import { WebSocketMessage, AudioChunkMessage, CoachingResult, RealtimeFeedback } from "../types";
import { useToast } from "../components/ui/modern/ToastContainer";
import webSocketService, { WebSocketEventHandlers } from "./websocket";

/**
 * useWebSocketService
 * Modern React hook for WebSocket integration with toast notifications and connection state.
 */
export function useWebSocketService(sessionId: string) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<typeof webSocketService | null>(null);
  const { showToast } = useToast();

  // Handlers for incoming messages
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  // Connect/reconnect logic
  const connect = useCallback(
    (handlers: Partial<WebSocketEventHandlers> = {}) => {
      setConnecting(true);
      setError(null);
      webSocketService
        .connect(sessionId, {
          ...handlers,
          onOpen: () => {
            setConnected(true);
            setConnecting(false);
            showToast("Connexion WebSocket établie", "success");
            handlers.onOpen?.();
          },
          onClose: (event) => {
            setConnected(false);
            setConnecting(false);
            showToast("Connexion WebSocket fermée", "info");
            handlers.onClose?.(event);
          },
          onError: (err) => {
            setError("Erreur WebSocket");
            setConnecting(false);
            showToast("Erreur WebSocket", "error");
            handlers.onError?.(err);
          },
          onMessage: (msg) => {
            setLastMessage(msg);
            handlers.onMessage?.(msg);
          },
          onCoachingResult: (result) => {
            showToast("Nouveau feedback de coaching reçu", "info");
            handlers.onCoachingResult?.(result);
          },
          onRealtimeFeedback: (feedback) => {
            showToast("Suggestion en temps réel reçue", "info");
            handlers.onRealtimeFeedback?.(feedback);
          },
          onMilestoneAchieved: (milestone) => {
            showToast("Nouveau palier atteint !", "success");
            handlers.onMilestoneAchieved?.(milestone);
          },
        })
        .catch((err) => {
          setError("Impossible de se connecter au WebSocket");
          setConnecting(false);
          showToast("Impossible de se connecter au WebSocket", "error");
        });
    },
    [sessionId, showToast]
  );

  // Disconnect logic
  const disconnect = useCallback(() => {
    webSocketService.disconnect();
    setConnected(false);
    setConnecting(false);
    showToast("Déconnecté du WebSocket", "info");
  }, [showToast]);

  // Send message
  const send = useCallback(
    (msg: WebSocketMessage) => {
      const ok = webSocketService.send(msg);
      if (!ok) {
        showToast("Échec de l'envoi du message WebSocket", "error");
      }
      return ok;
    },
    [showToast]
  );

  // Send audio chunk
  const sendAudioChunk = useCallback(
    (audioData: string, sampleRate: number = 16000) => {
      const ok = webSocketService.sendAudioChunk(audioData, sampleRate);
      if (!ok) {
        showToast("Échec de l'envoi du chunk audio", "error");
      }
      return ok;
    },
    [showToast]
  );

  // Send control message
  const sendControlMessage = useCallback(
    (action: "start" | "stop" | "pause" | "resume") => {
      const ok = webSocketService.sendControlMessage(action);
      if (!ok) {
        showToast("Échec de l'envoi du contrôle", "error");
      }
      return ok;
    },
    [showToast]
  );

  // Auto-disconnect on unmount
  useEffect(() => {
    return () => {
      webSocketService.disconnect();
    };
  }, []);

  return {
    connect,
    disconnect,
    send,
    sendAudioChunk,
    sendControlMessage,
    connected,
    connecting,
    error,
    lastMessage,
  };
}