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
  // Evite les faux positifs CONNECT_FAILED lors d’une fermeture volontaire (cleanup/toggle)
  private intentionalClose = false;
  private lastConnectAt = 0;

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
    // Ajout d'un handler global d'unload pour éviter des close() pendant CONNECTING qui polluent la console
    try {
      window.addEventListener("beforeunload", () => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.intentionalClose = true;
          try {
            this.ws.onopen = null as any;
            this.ws.onclose = null as any;
            this.ws.onerror = null as any;
            this.ws.onmessage = null as any;
          } catch {}
          // Ne pas appeler close() ici pour éviter le warning
          this.ws = null;
        }
      });
    } catch {}
  }

  private log(line: string) {
    const ts = new Date().toISOString();
    const msg = `[TtsClient ${ts}] ${line}`;
    try {
      // eslint-disable-next-line no-console
      console.debug(msg);
    } catch {}
    this.onLogHandlers.forEach((h) => h(msg));
  }

  private logClose(ev: CloseEvent) {
    this.log(
      `CLOSE: code=${ev.code} reason=${ev.reason || ""} wasClean=${ev.wasClean} ` +
      `intentional=${this.intentionalClose} sawReady=${this.sawReady} ` +
      `readyState=${this.ws?.readyState} sinceConnect=${Date.now() - this.lastConnectAt}ms`
    );
  }

  private logErrorEvent(e: Event) {
    const anyE: any = e || {};
    const parts = [
      `ERROR: type=${anyE?.type || "error"}`,
      anyE?.message ? `message=${String(anyE.message)}` : "",
      `url=${this.url}`,
      `readyState=${this.ws?.readyState}`,
      `sinceConnect=${Date.now() - this.lastConnectAt}ms`,
    ].filter(Boolean);
    this.log(parts.join(" "));
  }

  async connect(readyTimeoutMs = 5000): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.log(`connect: reuse existing ws state=${this.ws.readyState}`);
      return;
    }
    this.intentionalClose = false;
    this.lastConnectAt = Date.now();
    this.log(`connect: creating WebSocket to ${this.url} with readyTimeoutMs=${readyTimeoutMs}`);
    this.ws = new WebSocket(this.url);
    this.log(`connect: ws created, readyState=${this.ws.readyState}`);

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error("WS not created"));
      this.ws.binaryType = "arraybuffer";
      this.sawReady = false;

      this.ws.onopen = () => {
        this.log(`onopen: state=${this.ws?.readyState}`);
        if (this.readyTimeoutId) {
          clearTimeout(this.readyTimeoutId);
          this.readyTimeoutId = null;
        }
        this.readyTimeoutId = window.setTimeout(() => {
          if (!this.sawReady) {
            // Ne pas crier si la fermeture a été intentionnelle entre-temps
            if (this.intentionalClose) {
              this.log("ready timeout ignored (intentionalClose=true)");
              return;
            }
            const err: TtsError = { type: "tts.error", code: "READY_TIMEOUT", message: "No tts.ready within timeout" };
            this.log("ready timeout fired without tts.ready");
            this.onErrorHandlers.forEach((h) => h(err));
          }
        }, readyTimeoutMs);
        this.log(`armed ready timeout in ${readyTimeoutMs}ms`);
        resolve();
      };

      // Ne rejette pas la promesse ici pour éviter "WS connect error: [object Event]"
      this.ws.onerror = (e: Event) => {
        this.logErrorEvent(e);
        // on laisse onclose produire l'erreur normalisée si besoin
      };

      this.ws.onclose = (ev) => {
        this.logClose(ev);
        // Si fermeture intentionnelle ou normale 1000, ne rien reporter
        if (this.intentionalClose || ev.code === 1000) {
          this.log("onclose: ignored (intentional or normal close)");
          return;
        }
        // Si fermeture très tôt après création (ex: cleanup immédiat), ignorer pour éviter bruit
        const since = Date.now() - this.lastConnectAt;
        if (!this.sawReady && since < 100) {
          this.log(`onclose: ignored early close within ${since}ms after connect (likely cleanup)`);
          return;
        }
        // Si fermeture avant ready, normaliser le message
        if (!this.sawReady && (ev.code === 1006 || ev.code === 1008)) {
          const err: TtsError = {
            type: "tts.error",
            code: ev.code === 1008 ? "UNAUTHORIZED" : "CONNECT_FAILED",
            message: ev.reason || (ev.code === 1008 ? "Policy violation/Unauthorized" : "WS closed before ready"),
          };
          this.log(`emit error: ${JSON.stringify(err)}`);
          this.onErrorHandlers.forEach((h) => h(err));
          return;
        }
        // Codes autres: reporter générique pour information
        const err: TtsError = {
          type: "tts.error",
          code: "CONNECT_FAILED",
          message: `Closed code=${ev.code} reason=${ev.reason || ""} before ready=${!this.sawReady}`,
        };
        this.log(`emit error (generic): ${JSON.stringify(err)}`);
        this.onErrorHandlers.forEach((h) => h(err));
      };

      // First message handler: specifically watch for tts.ready quickly
      this.ws.onmessage = (evt) => {
        const isText = typeof evt.data === "string";
        if (isText) {
          this.log(`onmessage(pre-route): text(len=${String(evt.data).length}) ${String(evt.data).slice(0, 160)}`);
          try {
            const payload = JSON.parse(evt.data);
            this.log(`onmessage(pre-route): parsed type=${payload?.type}`);
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
        this.log("onmessage(pre-route): switched to routeMessage");
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
      this.log(`routeMessage: text(len=${data.length}) ${data.slice(0, 200)}`);
      try {
        const msg = JSON.parse(data);
        const type = msg?.type;
        this.log(`routeMessage: parsed type=${type}`);
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
    const ws = this.ws;
    if (ws) {
      this.intentionalClose = true;

      // Désarmer le timeout de readiness immédiatement
      if (this.readyTimeoutId) {
        clearTimeout(this.readyTimeoutId);
        this.readyTimeoutId = null;
      }

      // Détacher les handlers pour éviter les callbacks tardifs
      try {
        ws.onopen = null as any;
        ws.onclose = null as any;
        ws.onerror = null as any;
        ws.onmessage = null as any;
      } catch {}

      // Utiliser try/catch silencieux pour éviter tout warning console
      try {
        // Si CONNECTING, on ne ferme pas explicitement pour éviter le warning navigateur,
        // on laisse le GC/fermeture naturelle se faire après nullification des handlers.
        if (ws.readyState !== WebSocket.CONNECTING) {
          ws.close(1000, "intentional");
        }
      } catch {}

      // Déréférencer la socket pour laisser le navigateur la finaliser sans log
      this.ws = null;
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