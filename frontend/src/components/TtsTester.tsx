import React, { useEffect, useMemo, useRef, useState } from "react";
import TtsClient, { VisemeEvent, MetaEvent } from "../services/ttsClient";

type Props = {
  wsUrl?: string;
};

function createAudioContext(): AudioContext | null {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    return Ctx ? new Ctx() : null;
  } catch {
    return null;
  }
}

export const TtsTester: React.FC<Props> = ({ wsUrl = (import.meta as any)?.env?.VITE_BACKEND_WS_URL || "ws://127.0.0.1:8000/ws/tts" }) => {
  const tts = useMemo(() => new TtsClient(wsUrl), [wsUrl]);

  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);

  const [text, setText] = useState("Bonjour, ceci est un test de synthèse vocale en temps réel.");
  const [chunksCount, setChunksCount] = useState(0);
  const [visemes, setVisemes] = useState<VisemeEvent[]>([]);
  const [lastMeta, setLastMeta] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pings, setPings] = useState(0);
  const [authTestResult, setAuthTestResult] = useState<string>("");

  // New: WS logs panel
  const [wsLogs, setWsLogs] = useState<string[]>([]);

  // Simple audio playback pipeline using MediaSource for MP3
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Queue stores ArrayBuffer to satisfy MSE typings
  const queueRef = useRef<ArrayBuffer[]>([]);
  const httpAbortRef = useRef<AbortController | null>(null);
  const [useHttpFallback, setUseHttpFallback] = useState<boolean>(false);

  const initMediaSource = () => {
    if (!audioRef.current) return;
    if (!("MediaSource" in window)) {
      setErrors((prev) => [...prev, "MediaSource non supporté par ce navigateur"]);
      return;
    }
    mediaSourceRef.current = new MediaSource();
    const url = URL.createObjectURL(mediaSourceRef.current);
    audioRef.current.src = url;

    mediaSourceRef.current.addEventListener("sourceopen", () => {
      try {
        // mp3 mime - codec handled by browser
        sourceBufferRef.current = mediaSourceRef.current!.addSourceBuffer('audio/mpeg');
        sourceBufferRef.current.addEventListener("updateend", flushQueue);
      } catch (e) {
        setErrors((prev) => [...prev, `Erreur création SourceBuffer: ${String(e)}`]);
      }
    });
  };

  const flushQueue = () => {
    const sb = sourceBufferRef.current;
    if (!sb || sb.updating) return;
    const next = queueRef.current.shift();
    if (next) {
      try {
        // Ensure we pass an ArrayBuffer (not a SAB) to MSE
        const buf: ArrayBuffer = next instanceof ArrayBuffer ? next : new Uint8Array(next as any).slice().buffer as ArrayBuffer;
        sb.appendBuffer(buf);
      } catch (e) {
        setErrors((prev) => [...prev, `appendBuffer error: ${String(e)}`]);
      }
    }
  };

  // Minimal append for HTTP path (bypasses queue to reduce latency)
  const appendImmediate = (u8: Uint8Array) => {
    const sb = sourceBufferRef.current;
    if (!sb) return;
    const doAppend = () => {
      try {
        // Convert Uint8Array to ArrayBuffer for MSE
        const buf: ArrayBuffer = new Uint8Array(u8).buffer; // ensure plain ArrayBuffer
        sb.appendBuffer(buf);
      } catch (e) { setErrors((prev) => [...prev, `appendBuffer error: ${String(e)}`]); }
    };
    if (sb.updating) {
      const handler = () => {
        sb.removeEventListener("updateend", handler);
        doAppend();
      };
      sb.addEventListener("updateend", handler);
    } else {
      doAppend();
    }
  };

  const httpSpeak = async (text: string) => {
    // ensure media source ready
    if (!audioRef.current?.src) {
      initMediaSource();
    }
    // start streaming
    await httpSpeakImpl(
      text,
      (u8) => {
        appendImmediate(u8);
        setChunksCount((c) => c + 1);
        // autoplay
        if (audioRef.current && audioRef.current.paused) {
          audioRef.current.play().catch(() => {});
        }
      },
      (msg) => setErrors((prev) => [...prev, msg]),
      httpAbortRef
    );
  };

  useEffect(() => {
    initMediaSource();

    const offReady = tts.onReady(() => {
      setReady(true);
      setWsLogs((prev) => [...prev, "[UI] tts.ready reçu"]);
    });
    const offStartAck = tts.onStartAck(() => {
      setStarted(true);
      setWsLogs((prev) => [...prev, "[UI] tts.start ack reçu"]);
    });
    const offChunk = tts.onAudioChunk((buf) => {
      setChunksCount((c) => c + 1);
      // enqueue to media source
      queueRef.current.push(buf);
      flushQueue();
      // autoplay if paused
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    });
    const offViseme = tts.onViseme((v) => {
      setVisemes((arr) => {
        const next = [...arr, v];
        return next.length > 50 ? next.slice(-50) : next;
      });
    });
    const offMeta = tts.onMeta((m: MetaEvent) => setLastMeta(m));
    const offErr = tts.onError((e) => {
      // Highlight auth/connect issues
      try {
        const obj = typeof e === "string" ? { message: e } : e;
        if (obj?.code === "UNAUTHORIZED" || obj?.status === 401 || obj?.status === 403) {
          setErrors((prev) => [...prev, `AUTH ERROR (401/403): ${JSON.stringify(obj)}`]);
        } else if (obj?.code === "CONNECT_FAILED") {
          setErrors((prev) => [...prev, `CONNECT FAILED: ${JSON.stringify(obj)}`]);
        } else if (obj?.code === "READY_TIMEOUT") {
          setErrors((prev) => [...prev, `READY TIMEOUT: ${JSON.stringify(obj)}`]);
        } else {
          setErrors((prev) => [...prev, JSON.stringify(obj)]);
        }
      } catch {
        setErrors((prev) => [...prev, String(e)]);
      }
    });
    const offPing = tts.onPing(() => setPings((n) => n + 1));
    const offLog = tts.onLog((line) => setWsLogs((prev) => [...prev, line]));

    // Only connect WS when not using HTTP fallback
    if (!useHttpFallback) {
      tts
        .connect()
        .then(() => {
          setConnected(true);
          setWsLogs((prev) => [...prev, "[UI] connect() résolu"]);
        })
        .catch((e) => {
          setErrors((prev) => [...prev, `WS connect error: ${String(e)}`]);
          setWsLogs((prev) => [...prev, `[UI] connect() rejeté: ${String(e)}`]);
        });
    } else {
      setConnected(false);
      setReady(false);
      setStarted(false);
      setWsLogs((prev) => [...prev, "[UI] Mode HTTP fallback activé, WS non connecté"]);
    }

    return () => {
      offReady();
      offStartAck();
      offChunk();
      offViseme();
      offMeta();
      offErr();
      offPing();
      offLog();
      tts.disconnect();
      try { httpAbortRef.current?.abort(); } catch {}
      // cleanup media source
      try {
        if (mediaSourceRef.current && mediaSourceRef.current.readyState === "open") {
          mediaSourceRef.current.endOfStream();
        }
      } catch {}
      if (audioRef.current?.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, [tts, useHttpFallback]);

  const handleStart = async () => {
    try {
      if (useHttpFallback) {
        // no-op for HTTP
        return;
      }
      await tts.start({
        voiceId: "Rachel",
        model: "eleven_multilingual_v2",
        format: "mp3_44100_128",
        sampleRate: 44100,
        lang: "en",
      });
    } catch (e) {
      setErrors((prev) => [...prev, `start error: ${String(e)}`]);
    }
  };

  const handleSpeak = async () => {
    try {
      if (useHttpFallback) {
        await httpSpeak(text);
      } else {
        await tts.speakText(text);
      }
    } catch (e) {
      setErrors((prev) => [...prev, `speak error: ${String(e)}`]);
    }
  };

  const handleStop = async () => {
    try {
      if (useHttpFallback) {
        try { httpAbortRef.current?.abort(); } catch {}
        // close media source gracefully
        try {
          if (mediaSourceRef.current && mediaSourceRef.current.readyState === "open") {
            if (!sourceBufferRef.current?.updating) {
              mediaSourceRef.current.endOfStream();
            } else {
              sourceBufferRef.current?.addEventListener("updateend", function handler() {
                sourceBufferRef.current?.removeEventListener("updateend", handler);
                try { mediaSourceRef.current?.endOfStream(); } catch {}
              });
            }
          }
        } catch {}
      } else {
        await tts.end();
      }
    } catch (e) {
      setErrors((prev) => [...prev, `end error: ${String(e)}`]);
    }
  };

  const handleCancel = async () => {
    try {
      if (useHttpFallback) {
        try { httpAbortRef.current?.abort(); } catch {}
      } else {
        await tts.cancel();
      }
    } catch (e) {
      setErrors((prev) => [...prev, `cancel error: ${String(e)}`]);
    }
  };

  const testAuth = async () => {
    try {
      setAuthTestResult("Test en cours...");
      const resp = await fetch("/api/v1/debug/tts-auth");
      const text = await resp.text();
      setAuthTestResult(`HTTP ${resp.status}\n${text}`);
      if (!resp.ok) {
        setErrors((prev) => [...prev, `debug/tts-auth error HTTP ${resp.status}`]);
      }
    } catch (e) {
      setAuthTestResult(`Erreur: ${String(e)}`);
      setErrors((prev) => [...prev, `debug/tts-auth exception: ${String(e)}`]);
    }
  };

  const wsUrlDisplay = wsUrl;
  const httpBase = (import.meta as any)?.env?.VITE_BACKEND_HTTP_URL || "";

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Test TTS (WS / HTTP fallback)</h2>

      <div className="text-xs text-gray-700">
        <div>WS URL: <span className="font-mono">{wsUrlDisplay}</span></div>
        <div>HTTP Base: <span className="font-mono">{httpBase || "(relatif)"}</span></div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={useHttpFallback}
            onChange={(e) => {
              setUseHttpFallback(e.target.checked);
              setErrors((prev) => [...prev, `Mode: ${e.target.checked ? "HTTP fallback" : "WebSocket"}`]);
              setWsLogs((prev) => [...prev, `[UI] Toggle mode -> ${e.target.checked ? "HTTP" : "WS"}`]);
            }}
          />
          HTTP Stream fallback (/api/v1/tts-stream)
        </label>
        {!useHttpFallback && (
          <>
            <span className={connected ? "text-green-600" : "text-red-600"}>
              WS: {connected ? "connecté" : "déconnecté"}
            </span>
            <span className={ready ? "text-green-600" : "text-orange-600"}>ready: {String(ready)}</span>
            <span className={started ? "text-green-600" : "text-gray-600"}>started: {String(started)}</span>
            <span>pings: {pings}</span>
          </>
        )}
        <span>chunks: {chunksCount}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {!useHttpFallback && (
          <button onClick={handleStart} className="px-3 py-1 rounded bg-blue-600 text-white">
            Démarrer (tts.start)
          </button>
        )}
        <button onClick={handleSpeak} className="px-3 py-1 rounded bg-emerald-600 text-white">
          Parler ({useHttpFallback ? "HTTP /tts-stream" : "tts.text"})
        </button>
        <button onClick={handleCancel} className="px-3 py-1 rounded bg-yellow-600 text-white">
          Annuler
        </button>
        <button onClick={handleStop} className="px-3 py-1 rounded bg-red-600 text-white">
          Stop ({useHttpFallback ? "HTTP end" : "tts.end"})
        </button>
        <button onClick={testAuth} className="px-3 py-1 rounded bg-indigo-600 text-white">
          Tester /api/v1/debug/tts-auth
        </button>
      </div>

      {authTestResult && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Résultat debug/tts-auth</label>
          <pre className="text-xs p-2 bg-gray-50 border rounded overflow-auto whitespace-pre-wrap text-black">{authTestResult}</pre>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm">Texte:</label>
        <textarea
          className="w-full min-h-[80px] p-2 border rounded"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Lecture audio</label>
        <audio ref={audioRef} controls className="w-full" />
        <p className="text-xs text-gray-500">
          Le flux MP3 est ajouté en continu via MediaSource. En mode HTTP, les chunks proviennent de /api/v1/tts-stream.
        </p>
      </div>

      <div>
        <h3 className="font-medium">Visèmes (derniers 50)</h3>
        <div className="max-h-40 overflow-auto text-xs border rounded p-2 bg-gray-50 text-black">
          {visemes.map((v, i) => (
            <div key={i}>
              t={v.time_ms}ms morph={v.morph} w={v.weight}
            </div>
          ))}
          {visemes.length === 0 && <div className="text-gray-400">Aucun visème reçu pour l’instant.</div>}
        </div>
      </div>

      <div>
        <h3 className="font-medium">Dernier meta</h3>
        <pre className="text-xs p-2 bg-gray-50 border rounded overflow-auto text-black">
{JSON.stringify(lastMeta, null, 2)}
        </pre>
      </div>

      <div>
        <h3 className="font-medium">Erreurs</h3>
        <div className="text-xs p-2 bg-red-50 border rounded overflow-auto text-black">
          {errors.length ? errors.map((e, i) => <div key={i}>&#x2022; {e}</div>) : <div className="text-gray-400">Aucune</div>}
        </div>
      </div>

      <div>
        <h3 className="font-medium">Logs WS (client)</h3>
        <div className="text-xs p-2 bg-gray-100 border rounded overflow-auto max-h-56 text-black">
          {wsLogs.length ? wsLogs.map((l, i) => <div key={i} className="font-mono whitespace-pre-wrap">{l}</div>) : <div className="text-gray-400">Aucun log</div>}
        </div>
        <button
          onClick={() => setWsLogs([])}
          className="mt-2 px-3 py-1 rounded bg-gray-600 text-white"
        >
          Clear logs
        </button>
      </div>
    </div>
  );
};

async function httpSpeakImpl(
  text: string,
  appendChunk: (u8: Uint8Array) => void,
  onError: (msg: string) => void,
  abortRef: React.MutableRefObject<AbortController | null>
) {
  try {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const base = (import.meta as any)?.env?.VITE_BACKEND_HTTP_URL || "";
    const url = `${base}/api/v1/tts-stream`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model: "eleven_multilingual_v2",
        format: "mp3_44100_128",
        voiceId: "Rachel",
      }),
      signal: ctrl.signal,
    });

    const reader = resp.body?.getReader();
    if (!reader) {
      throw new Error(`Pas de corps de réponse (HTTP ${resp.status})`);
    }

    const decoder = new TextDecoder();
    // Auto-play
    try { (document.querySelector("audio") as HTMLAudioElement)?.play().catch(() => {}); } catch {}

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;

      // Heuristique: JSON error chunk
      const isJsonish = value[0] === 0x7b /*{*/ || value[0] === 0x5b /*[*/;
      if (isJsonish) {
        try {
          const s = decoder.decode(value);
          const obj = JSON.parse(s);
          onError(`UPSTREAM_ERROR: ${JSON.stringify(obj)}`);
          continue;
        } catch {
          // append as audio if not valid json
        }
      }
      appendChunk(value);
    }
  } catch (e: any) {
    onError(`HTTP_STREAM_ERROR: ${e?.message || String(e)}`);
  }
}

export default TtsTester;