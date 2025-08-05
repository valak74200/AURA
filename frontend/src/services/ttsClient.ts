/**
 * WebSocket TTS Client for AURA - connects to backend /ws/tts
 * Protocol:
 *  - Send: "tts.start" to configure session
 *  - Send: "tts.text" / "tts.ssml" to synthesize
 *  - Send: "tts.cancel" / "tts.end" to control
 *  - Receive:
 *      * Binary audio frames (ArrayBuffer)
 *      * JSON events: tts.ready, tts.start (ack), tts.viseme, tts.meta, ping, tts.end, tts.error
 *
 * Diagnostics added:
 *  - Ready timeout (READY_TIMEOUT) if no tts.ready within a delay after open
 *  - Explicit mapping for backend-propagated errors: UNAUTHORIZED/CONNECT_FAILED with status
 *  - Close code 1006 before ready => CONNECT_FAILED
 *  - Verbose client-side logs for URL, lifecycle and message routing
 */
export type TtsStartOptions = {
  voiceId?: string;
  model?: string;
  format?: string; // e.g., mp3_44100_128
  sampleRate?: number;
  lang?: string;
};

export type VisemeEvent = {
  type: "tts.viseme";
  time_ms: number;
  morph: string;
  weight: number;
};

export type TtsError =
  | { type: "tts.error"; code: "READY_TIMEOUT"; message: string }
  | { type: "tts.error"; code: "CONNECT_FAILED"; status?: number; message?: string }
  | { type: "tts.error"; code: "UNAUTHORIZED"; status?: number; message?: string }
  | { type: "tts.error"; code: string; message?: string; [k: string]: any };

export type MetaEvent = {
  type: "tts.meta";
  data: any;
};

export type PingEvent = { type: "ping" } | { type: "tts.end" };

type EventHandler = (data: any) => void;

export class TtsClient {
  private url: string;
  private ws: WebSocket | null = null;
  private sawReady = false;
  private readyTimeoutId: number | null = null;

  private onAudioChunkHandlers: ((chunk: ArrayBuffer) => void)[] = [];
  private onVisemeHandlers: ((v: VisemeEvent) => void)[] = [];
  private onMetaHandlers: ((m: MetaEvent) => void)[] = [];
  private onErrorHandlers: ((e: TtsError | any) => void)[] = [];
  private onPingHandlers: ((p: PingEvent) => void)[] = [];
  private onReadyHandlers: EventHandler[] = [];
  private onStartAckHandlers: EventHandler[] = [];
  private onLogHandlers: ((line: string) => void)[] = [];

  constructor(url = (import.meta as any)?.env?.VITE_BACKEND_WS_URL || "ws://127.0.0.1:8000/ws/tts") {
    this.url = url;
    this.log(`init: url=${this.url}`);
  }

  private log(line: string) {
    const ts = new Date().toISOString();
    const msg = `[TtsClient ${ts}] ${line}`;
    // console log for devtools
    try { // avoid crashing in unusual envs
      // eslint-disable-next-line no-console
      console.debug(msg);
    } catch {}
    this.onLogHandlers.forEach((h) => h(msg));
  }

  async connect(readyTimeoutMs = 5000): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.log(`connect: reuse existing ws state=${this.ws.readyState}`);
      return;
    }
    this.log(`connect: creating WebSocket to ${this.url} with readyTimeoutMs=${readyTimeoutMs}`);
    this.ws = new WebSocket(this.url);

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error("WS not created"));
      this.ws.binaryType = "arraybuffer";
      this.sawReady = false;

      this.ws.onopen = () => {
        this.log("onopen");
        if (this.readyTimeoutId) {
          clearTimeout(this.readyTimeoutId);
          this.readyTimeoutId = null;
        }
        this.readyTimeoutId = window.setTimeout(() => {
          if (!this.sawReady) {
            const err: TtsError = { type: "tts.error", code: "READY_TIMEOUT", message: "No tts.ready within timeout" };
            this.log("ready timeout fired without tts.ready");
            this.onErrorHandlers.forEach((h) => h(err));
          }
        }, readyTimeoutMs);
        this.log(`armed ready timeout in ${readyTimeoutMs}ms`);
        resolve();
      };

      this.ws.onerror = (e) => {
        this.log(`onerror: ${String((e as any)?.message || e)}`);
        reject(e as any);
      };

      this.ws.onclose = (ev) => {
        this.log(`onclose: code=${ev.code} reason=${ev.reason || ""} wasClean=${ev.wasClean}`);
        if (!this.sawReady && (ev.code === 1006 || ev.code === 1008)) {
          const err: TtsError = {
            type: "tts.error",
            code: ev.code === 1008 ? "UNAUTHORIZED" : "CONNECT_FAILED",
            message: ev.reason || (ev.code === 1008 ? "Policy violation/Unauthorized" : "WS closed before ready"),
          };
          this.onErrorHandlers.forEach((h) => h(err));
        }
      };

      // First message handler: specifically watch for tts.ready quickly
      this.ws.onmessage = (evt) => {
        const isText = typeof evt.data === "string";
        if (isText) {
          this.log(`onmessage(pre-route): text=${String(evt.data).slice(0, 160)}`);
          try {
            const payload = JSON.parse(evt.data);
            if (payload?.type === "tts.ready") {
              this.sawReady = true;
              if (this.readyTimeoutId) {
                clearTimeout(this.readyTimeoutId);
                this.readyTimeoutId = null;
              }
              this.log("received tts.ready (pre-route)");
              this.onReadyHandlers.forEach((h) => h(payload));
            }
          } catch {
            // ignore JSON parse errors here
          }
        } else {
          const ab = evt.data as ArrayBuffer;
          this.log(`onmessage(pre-route): binary ${ab.byteLength} bytes`);
        }
        if (!this.ws) return;
        this.ws.onmessage = (event) => this.routeMessage(event);
      };
    });
  }

  private routeMessage(event: MessageEvent) {
    const data = event.data;
    if (data instanceof ArrayBuffer) {
      this.log(`routeMessage: binary chunk ${data.byteLength} bytes`);
      this.onAudioChunkHandlers.forEach((h) => h(data));
      return;
    }
    if (typeof data === "string") {
      // preview log
      this.log(`routeMessage: text=${data.slice(0, 200)}`);
      try {
        const msg = JSON.parse(data);
        const type = msg?.type;
        switch (type) {
          case "tts.start":
            this.onStartAckHandlers.forEach((h) => h(msg));
            break;
          case "tts.viseme":
            this.onVisemeHandlers.forEach((h) => h(msg as VisemeEvent));
            break;
          case "tts.meta":
            this.onMetaHandlers.forEach((h) => h(msg as MetaEvent));
            break;
          case "ping":
          case "tts.end":
            this.onPingHandlers.forEach((h) => h(msg as PingEvent));
            break;
          case "tts.error":
          case "error": {
            const norm: TtsError = (() => {
              const code: string = msg.code || msg.error || "UNKNOWN";
              const status: number | undefined = msg.status || msg.http_status;
              if (code === "UNAUTHORIZED" || status === 401 || status === 403) {
                return { type: "tts.error", code: "UNAUTHORIZED", status, message: msg.message || "Unauthorized" };
              }
              if (code === "CONNECT_FAILED") {
                return { type: "tts.error", code, status, message: msg.message || "Connection failed" };
              }
              return { type: "tts.error", code, status, message: msg.message };
            })();
            this.log(`normalized error: ${JSON.stringify(norm)}`);
            this.onErrorHandlers.forEach((h) => h(norm));
            break;
          }
          case "tts.ready": {
            this.sawReady = true;
            if (this.readyTimeoutId) {
              clearTimeout(this.readyTimeoutId);
              this.readyTimeoutId = null;
            }
            this.log("received tts.ready");
            this.onReadyHandlers.forEach((h) => h(msg));
            break;
          }
          default:
            this.onMetaHandlers.forEach((h) => h({ type: "tts.meta", data: msg }));
        }
      } catch {
        // not JSON
      }
    }
  }

  private async ensureConnected() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
  }

  async start(opts: TtsStartOptions = {}): Promise<void> {
    await this.ensureConnected();
    const payload = {
      type: "tts.start",
      voiceId: opts.voiceId,
      model: opts.model,
      format: opts.format,
      sampleRate: opts.sampleRate,
      lang: opts.lang,
    };
    this.log(`send: ${JSON.stringify(payload)}`);
    this.ws!.send(JSON.stringify(payload));
  }

  async speakText(text: string): Promise<void> {
    await this.ensureConnected();
    const payload = { type: "tts.text", text };
    this.log(`send: ${JSON.stringify(payload).slice(0, 200)}`);
    this.ws!.send(JSON.stringify(payload));
  }

  async speakSsml(ssml: string): Promise<void> {
    await this.ensureConnected();
    const payload = { type: "tts.ssml", ssml };
    this.log(`send: ${JSON.stringify(payload).slice(0, 200)}`);
    this.ws!.send(JSON.stringify(payload));
  }

  async cancel(): Promise<void> {
    if (!this.ws) return;
    const payload = { type: "tts.cancel" };
    this.log(`send: ${JSON.stringify(payload)}`);
    this.ws.send(JSON.stringify(payload));
  }

  async end(): Promise<void> {
    if (!this.ws) return;
    const payload = { type: "tts.end" };
    this.log(`send: ${JSON.stringify(payload)}`);
    this.ws.send(JSON.stringify(payload));
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      try {
        this.log("disconnect: closing ws");
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    if (this.readyTimeoutId) {
      clearTimeout(this.readyTimeoutId);
      this.readyTimeoutId = null;
    }
    this.sawReady = false;
  }

  onAudioChunk(handler: (chunk: ArrayBuffer) => void) {
    this.onAudioChunkHandlers.push(handler);
    return () => (this.onAudioChunkHandlers = this.onAudioChunkHandlers.filter((h) => h !== handler));
  }
  onViseme(handler: (v: VisemeEvent) => void) {
    this.onVisemeHandlers.push(handler);
    return () => (this.onVisemeHandlers = this.onVisemeHandlers.filter((h) => h !== handler));
  }
  onMeta(handler: (m: MetaEvent) => void) {
    this.onMetaHandlers.push(handler);
    return () => (this.onMetaHandlers = this.onMetaHandlers.filter((h) => h !== handler));
  }
  onError(handler: EventHandler) {
    this.onErrorHandlers.push(handler);
    return () => (this.onErrorHandlers = this.onErrorHandlers.filter((h) => h !== handler));
  }
  onPing(handler: (p: PingEvent) => void) {
    this.onPingHandlers.push(handler);
    return () => (this.onPingHandlers = this.onPingHandlers.filter((h) => h !== handler));
  }
  onReady(handler: EventHandler) {
    this.onReadyHandlers.push(handler);
    return () => (this.onReadyHandlers = this.onReadyHandlers.filter((h) => h !== handler));
  }
  onStartAck(handler: EventHandler) {
    this.onStartAckHandlers.push(handler);
    return () => (this.onStartAckHandlers = this.onStartAckHandlers.filter((h) => h !== handler));
  }
  onLog(handler: (line: string) => void) {
    this.onLogHandlers.push(handler);
    return () => (this.onLogHandlers = this.onLogHandlers.filter((h) => h !== handler));
  }
}

export default TtsClient;