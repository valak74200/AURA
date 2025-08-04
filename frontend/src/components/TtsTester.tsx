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

export const TtsTester: React.FC<Props> = ({ wsUrl = "ws://127.0.0.1:8000/ws/tts" }) => {
  const tts = useMemo(() => new TtsClient(wsUrl), [wsUrl]);

  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);

  const [text, setText] = useState("Bonjour, ceci est un test de synthèse vocale en temps réel.");
  const [chunksCount, setChunksCount] = useState(0);
  const [visemes, setVisemes] = useState<VisemeEvent[]>([]);
  const [lastMeta, setLastMeta] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pings, setPings] = useState<number>(0);

  // Simple audio playback pipeline using MediaSource for MP3
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);

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
        sb.appendBuffer(next);
      } catch (e) {
        setErrors((prev) => [...prev, `appendBuffer error: ${String(e)}`]);
      }
    }
  };

  useEffect(() => {
    initMediaSource();

    const offReady = tts.onReady(() => setReady(true));
    const offStartAck = tts.onStartAck(() => setStarted(true));
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
    const offErr = tts.onError((e) => setErrors((prev) => [...prev, JSON.stringify(e)]));
    const offPing = tts.onPing(() => setPings((n) => n + 1));

    tts
      .connect()
      .then(() => setConnected(true))
      .catch((e) => setErrors((prev) => [...prev, `WS connect error: ${String(e)}`]));

    return () => {
      offReady();
      offStartAck();
      offChunk();
      offViseme();
      offMeta();
      offErr();
      offPing();
      tts.disconnect();
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
  }, [tts]);

  const handleStart = async () => {
    try {
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
      await tts.speakText(text);
    } catch (e) {
      setErrors((prev) => [...prev, `speak error: ${String(e)}`]);
    }
  };

  const handleStop = async () => {
    try {
      await tts.end();
    } catch (e) {
      setErrors((prev) => [...prev, `end error: ${String(e)}`]);
    }
  };

  const handleCancel = async () => {
    try {
      await tts.cancel();
    } catch (e) {
      setErrors((prev) => [...prev, `cancel error: ${String(e)}`]);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Test WS TTS</h2>

      <div className="flex items-center gap-2 text-sm">
        <span className={connected ? "text-green-600" : "text-red-600"}>
          WS: {connected ? "connecté" : "déconnecté"}
        </span>
        <span className={ready ? "text-green-600" : "text-orange-600"}>ready: {String(ready)}</span>
        <span className={started ? "text-green-600" : "text-gray-600"}>started: {String(started)}</span>
        <span>chunks: {chunksCount}</span>
        <span>pings: {pings}</span>
      </div>

      <div className="flex gap-2">
        <button onClick={handleStart} className="px-3 py-1 rounded bg-blue-600 text-white">
          Démarrer (tts.start)
        </button>
        <button onClick={handleSpeak} className="px-3 py-1 rounded bg-emerald-600 text-white">
          Parler (tts.text)
        </button>
        <button onClick={handleCancel} className="px-3 py-1 rounded bg-yellow-600 text-white">
          Annuler
        </button>
        <button onClick={handleStop} className="px-3 py-1 rounded bg-red-600 text-white">
          Stop (tts.end)
        </button>
      </div>

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
        <p className="text-xs text-gray-500">Le flux binaire MP3 est ajouté en continu via MediaSource.</p>
      </div>

      <div>
        <h3 className="font-medium">Visèmes (derniers 50)</h3>
        <div className="max-h-40 overflow-auto text-xs border rounded p-2 bg-gray-50">
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
        <pre className="text-xs p-2 bg-gray-50 border rounded overflow-auto">
{JSON.stringify(lastMeta, null, 2)}
        </pre>
      </div>

      <div>
        <h3 className="font-medium">Erreurs</h3>
        <div className="text-xs p-2 bg-red-50 border rounded overflow-auto">
          {errors.length ? errors.map((e, i) => <div key={i}>&#x2022; {e}</div>) : <div className="text-gray-400">Aucune</div>}
        </div>
      </div>
    </div>
  );
};

export default TtsTester;