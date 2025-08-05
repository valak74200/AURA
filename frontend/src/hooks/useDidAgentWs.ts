import { useCallback, useEffect, useRef, useState } from "react";

type AgentEvent =
  | { type: "open" }
  | { type: "close"; code?: number; reason?: string }
  | { type: "error"; error: any }
  | { type: "message"; data: any }
  | { type: "binary"; data: ArrayBuffer };

export interface UseDidAgentWsOptions {
  wsBaseUrl?: string; // e.g. ws://localhost:8000
  agentId?: string;
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectMaxRetries?: number;
  reconnectBaseDelayMs?: number; // backoff base, e.g. 500
}

export interface UseDidAgentWs {
  status: "idle" | "connecting" | "open" | "closing" | "closed" | "error";
  lastEvent?: AgentEvent;
  connect: (agentId?: string) => void;
  disconnect: () => void;
  sendJson: (obj: any) => void;
  sendText: (text: string) => void;
  sendBinary: (bytes: ArrayBuffer | Uint8Array) => void;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useDidAgentWs(opts?: UseDidAgentWsOptions): UseDidAgentWs {
  const {
    wsBaseUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000",
    agentId: initialAgentId = import.meta.env.VITE_DID_AGENT_ID,
    autoConnect = false,
    reconnect = true,
    reconnectMaxRetries = 5,
    reconnectBaseDelayMs = 500,
  } = opts || {};

  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<UseDidAgentWs["status"]>("idle");
  const [lastEvent, setLastEvent] = useState<AgentEvent | undefined>(undefined);
  const agentIdRef = useRef<string | undefined>(initialAgentId);
  const closingRef = useRef(false);
  const retryRef = useRef(0);

  const makeUrl = useCallback(
    (id: string) => {
      // Ensure there's no trailing slash
      const base = wsBaseUrl.replace(/\/+$/, "");
      return `${base}/ws/agent/${encodeURIComponent(id)}`;
    },
    [wsBaseUrl]
  );

  const cleanup = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
    }
    wsRef.current = null;
  }, []);

  const openSocket = useCallback(async () => {
    const id = agentIdRef.current;
    if (!id) {
      setStatus("error");
      setLastEvent({ type: "error", error: new Error("Missing agentId") });
      return;
    }

    try {
      setStatus("connecting");
      const url = makeUrl(id);
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("open");
        setLastEvent({ type: "open" });
        // Announce start to backend bridge
        ws.send(JSON.stringify({ type: "agent.start" }));
      };

      ws.onclose = async (ev) => {
        setStatus("closed");
        setLastEvent({ type: "close", code: ev.code, reason: ev.reason });
        cleanup();

        if (!closingRef.current && reconnect && retryRef.current < reconnectMaxRetries) {
          // Exponential backoff with jitter
          retryRef.current += 1;
          const delay = Math.min(
            reconnectBaseDelayMs * Math.pow(2, retryRef.current - 1),
            8000
          );
          await sleep(delay + Math.random() * 250);
          openSocket();
        }
      };

      ws.onerror = (err) => {
        setStatus("error");
        setLastEvent({ type: "error", error: err });
      };

      ws.onmessage = (ev: MessageEvent) => {
        if (typeof ev.data === "string") {
          try {
            const obj = JSON.parse(ev.data);
            setLastEvent({ type: "message", data: obj });
          } catch {
            setLastEvent({ type: "message", data: ev.data });
          }
        } else if (ev.data instanceof ArrayBuffer) {
          setLastEvent({ type: "binary", data: ev.data });
        } else if (ev.data?.arrayBuffer) {
          // Blob -> ArrayBuffer
          (ev.data as Blob)
            .arrayBuffer()
            .then((buf) => setLastEvent({ type: "binary", data: buf }))
            .catch((e) => setLastEvent({ type: "error", error: e }));
        }
      };
    } catch (e) {
      setStatus("error");
      setLastEvent({ type: "error", error: e });
      cleanup();
    }
  }, [cleanup, makeUrl, reconnect, reconnectBaseDelayMs, reconnectMaxRetries]);

  const connect = useCallback(
    (id?: string) => {
      if (id) agentIdRef.current = id;
      closingRef.current = false;
      // Close previous if any
      if (wsRef.current && (status === "open" || status === "connecting")) {
        try {
          wsRef.current.close(1000, "reconnect");
        } catch {
          // ignore
        }
      }
      openSocket();
    },
    [openSocket, status]
  );

  const disconnect = useCallback(() => {
    closingRef.current = true;
    setStatus("closing");
    const ws = wsRef.current;
    if (ws) {
      try {
        // Announce end to backend bridge
        ws.send(JSON.stringify({ type: "agent.end" }));
      } catch {
        // ignore
      }
      try {
        ws.close(1000, "client-close");
      } catch {
        // ignore
      }
    }
  }, []);

  const sendJson = useCallback((obj: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }, []);

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(text);
    }
  }, []);

  const sendBinary = useCallback((bytes: ArrayBuffer | Uint8Array) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    }
  }, []);

  useEffect(() => {
    if (autoConnect && agentIdRef.current) {
      connect(agentIdRef.current);
    }
    return () => {
      // cleanup on unmount
      closingRef.current = true;
      const ws = wsRef.current;
      if (ws) {
        try {
          ws.close(1000, "unmount");
        } catch {
          // ignore
        }
      }
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, lastEvent, connect, disconnect, sendJson, sendText, sendBinary };
}