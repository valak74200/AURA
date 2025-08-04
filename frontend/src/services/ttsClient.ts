/**
 * WebSocket TTS Client for AURA - connects to backend /ws/tts
 * Protocol:
 *  - Send: "tts.start" to configure session
 *  - Send: "tts.text" / "tts.ssml" to synthesize
 *  - Send: "tts.cancel" / "tts.end" to control
 *  - Receive:
 *      * Binary audio frames (ArrayBuffer)
 *      * JSON events: tts.ready, tts.start (ack), tts.viseme, tts.meta, ping, tts.end, tts.error
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

export type MetaEvent = {
  type: "tts.meta";
  data: any;
};

export type PingEvent = { type: "ping" } | { type: "tts.end" };

type EventHandler = (data: any) => void;

export class TtsClient {
  private url: string;
  private ws: WebSocket | null = null;

  private onAudioChunkHandlers: ((chunk: ArrayBuffer) => void)[] = [];
  private onVisemeHandlers: ((v: VisemeEvent) => void)[] = [];
  private onMetaHandlers: ((m: MetaEvent) => void)[] = [];
  private onErrorHandlers: EventHandler[] = [];
  private onPingHandlers: ((p: PingEvent) => void)[] = [];
  private onReadyHandlers: EventHandler[] = [];
  private onStartAckHandlers: EventHandler[] = [];

  constructor(url = "ws://127.0.0.1:8000/ws/tts") {
    this.url = url;
  }

  async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.ws = new WebSocket(this.url);
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error("WS not created"));
      this.ws.binaryType = "arraybuffer";
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e as any);
      this.ws.onmessage = (evt) => {
        try {
          if (typeof evt.data === "string") {
            const payload = JSON.parse(evt.data);
            if (payload?.type === "tts.ready") {
              this.onReadyHandlers.forEach((h) => h(payload));
            }
          }
        } catch {
          // ignore
        }
        if (!this.ws) return;
        this.ws.onmessage = (event) => this.routeMessage(event);
      };
    });
  }

  private routeMessage(event: MessageEvent) {
    const data = event.data;
    if (data instanceof ArrayBuffer) {
      this.onAudioChunkHandlers.forEach((h) => h(data));
      return;
    }
    if (typeof data === "string") {
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
          case "error":
            this.onErrorHandlers.forEach((h) => h(msg));
            break;
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
    this.ws!.send(
      JSON.stringify({
        type: "tts.start",
        voiceId: opts.voiceId,
        model: opts.model,
        format: opts.format,
        sampleRate: opts.sampleRate,
        lang: opts.lang,
      })
    );
  }

  async speakText(text: string): Promise<void> {
    await this.ensureConnected();
    this.ws!.send(JSON.stringify({ type: "tts.text", text }));
  }

  async speakSsml(ssml: string): Promise<void> {
    await this.ensureConnected();
    this.ws!.send(JSON.stringify({ type: "tts.ssml", ssml }));
  }

  async cancel(): Promise<void> {
    if (!this.ws) return;
    this.ws.send(JSON.stringify({ type: "tts.cancel" }));
  }

  async end(): Promise<void> {
    if (!this.ws) return;
    this.ws.send(JSON.stringify({ type: "tts.end" }));
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
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
}

export default TtsClient;