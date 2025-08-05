import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDidAgentWs } from "../../hooks/useDidAgentWs";

type LogItem = {
  ts: string;
  dir: "in" | "out" | "sys";
  kind: "text" | "json" | "binary";
  payload: any;
};

function nowIso() {
  return new Date().toISOString();
}

export default function AgentPage() {
  const defaultWs = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
  const defaultAgent = import.meta.env.VITE_DID_AGENT_ID || "";

  const [wsBaseUrl, setWsBaseUrl] = useState<string>(defaultWs);
  const [agentId, setAgentId] = useState<string>(defaultAgent);
  const [prompt, setPrompt] = useState<string>("Bonjour, qui es-tu ?");
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [autoReconnect, setAutoReconnect] = useState<boolean>(true);

  const { status, lastEvent, connect, disconnect, sendJson, sendText, sendBinary } =
    useDidAgentWs({
      wsBaseUrl,
      agentId,
      autoConnect: false,
      reconnect: autoReconnect,
      reconnectBaseDelayMs: 500,
      reconnectMaxRetries: 5,
    });

  const appendLog = useCallback((entry: LogItem) => {
    setLogs((prev) => [entry, ...prev].slice(0, 200));
  }, []);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "open") {
      appendLog({ ts: nowIso(), dir: "sys", kind: "text", payload: "WS open" });
    } else if (lastEvent.type === "close") {
      appendLog({
        ts: nowIso(),
        dir: "sys",
        kind: "text",
        payload: `WS close code=${lastEvent.code} reason=${lastEvent.reason || ""}`,
      });
    } else if (lastEvent.type === "error") {
      appendLog({ ts: nowIso(), dir: "sys", kind: "text", payload: `WS error: ${String(lastEvent.error)}` });
    } else if (lastEvent.type === "message") {
      const data = lastEvent.data;
      appendLog({
        ts: nowIso(),
        dir: "in",
        kind: typeof data === "string" ? "text" : "json",
        payload: data,
      });
    } else if (lastEvent.type === "binary") {
      appendLog({ ts: nowIso(), dir: "in", kind: "binary", payload: `binary[${lastEvent.data?.byteLength || 0}]` });
    }
  }, [lastEvent, appendLog]);

  const onConnect = useCallback(() => {
    if (!agentId) {
      appendLog({ ts: nowIso(), dir: "sys", kind: "text", payload: "agentId manquant" });
      return;
    }
    appendLog({ ts: nowIso(), dir: "sys", kind: "text", payload: `Connect to ${wsBaseUrl}/ws/agent/${agentId}` });
    connect(agentId);
  }, [agentId, wsBaseUrl, connect, appendLog]);

  const onDisconnect = useCallback(() => {
    appendLog({ ts: nowIso(), dir: "sys", kind: "text", payload: "Disconnect requested" });
    disconnect();
  }, [disconnect, appendLog]);

  const sendPrompt = useCallback(() => {
    const payload = { type: "agent.prompt", data: { text: prompt } };
    sendJson(payload);
    appendLog({ ts: nowIso(), dir: "out", kind: "json", payload });
  }, [prompt, sendJson, appendLog]);

  const sendKeepalive = useCallback(() => {
    const payload = { type: "agent.keepalive" };
    sendJson(payload);
    appendLog({ ts: nowIso(), dir: "out", kind: "json", payload });
  }, [sendJson, appendLog]);

  const sendRawText = useCallback(() => {
    const text = JSON.stringify({ hello: "raw" });
    sendText(text);
    appendLog({ ts: nowIso(), dir: "out", kind: "text", payload: text });
  }, [sendText, appendLog]);

  const sendBinarySilence = useCallback(() => {
    // small "silence" buffer
    const bytes = new Uint8Array(320); // ~10ms @16kHz int16 (placeholder)
    sendBinary(bytes);
    appendLog({ ts: nowIso(), dir: "out", kind: "binary", payload: `binary[${bytes.byteLength}]` });
  }, [sendBinary, appendLog]);

  const statusColor = useMemo(() => {
    switch (status) {
      case "open":
        return "text-green-600";
      case "connecting":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      case "closing":
        return "text-yellow-700";
      case "closed":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  }, [status]);

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Agent D‑ID (WS)</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium">WS Base URL</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={wsBaseUrl}
              onChange={(e) => setWsBaseUrl(e.target.value)}
              placeholder="ws://localhost:8000"
            />
            <small className="text-gray-500">Lu depuis VITE_WS_URL par défaut</small>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Agent ID</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="agent-demo-1"
            />
            <small className="text-gray-500">Lu depuis VITE_DID_AGENT_ID si défini</small>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="reconnect"
              type="checkbox"
              checked={autoReconnect}
              onChange={(e) => setAutoReconnect(e.target.checked)}
            />
            <label htmlFor="reconnect" className="text-sm">
              Reconnexion automatique (backoff)
            </label>
          </div>

          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              onClick={onConnect}
              disabled={status === "open" || status === "connecting" || !agentId}
            >
              Connecter
            </button>
            <button
              className="px-3 py-2 rounded bg-gray-600 text-white disabled:opacity-50"
              onClick={onDisconnect}
              disabled={status !== "open" && status !== "connecting" && status !== "closing"}
            >
              Déconnecter
            </button>
            <div className={`ml-auto text-sm ${statusColor}`}>Statut: {status}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Prompt</label>
            <textarea
              className="w-full border rounded px-3 py-2 h-24"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
              onClick={sendPrompt}
              disabled={status !== "open"}
            >
              Envoyer prompt
            </button>
            <button
              className="px-3 py-2 rounded bg-orange-600 text-white disabled:opacity-50"
              onClick={sendKeepalive}
              disabled={status !== "open"}
            >
              Keepalive
            </button>
            <button
              className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
              onClick={sendRawText}
              disabled={status !== "open"}
            >
              Envoyer texte brut
            </button>
            <button
              className="px-3 py-2 rounded bg-teal-700 text-white disabled:opacity-50"
              onClick={sendBinarySilence}
              disabled={status !== "open"}
            >
              Envoyer binaire (silence)
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Logs</div>
        <div className="border rounded p-2 h-72 overflow-auto bg-gray-50">
          <ul className="space-y-1">
            {logs.map((l, idx) => {
              const color =
                l.dir === "in" ? "text-blue-700" : l.dir === "out" ? "text-emerald-700" : "text-gray-600";
              return (
                <li key={idx} className={`text-xs ${color}`}>
                  <span className="mr-2 opacity-60">{l.ts}</span>
                  <span className="mr-2">[{l.dir}]</span>
                  <span className="mr-2">({l.kind})</span>
                  <span>
                    {typeof l.payload === "string" ? l.payload : <pre className="inline">{JSON.stringify(l.payload)}</pre>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}