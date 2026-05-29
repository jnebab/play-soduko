import type { ClientMsg, ServerMsg } from "@sudoku/engine";

export type ConnectionState = "connecting" | "open" | "closed";

export interface WsClientOptions {
  url: string;
  onMessage: (msg: ServerMsg) => void;
  onStateChange?: (state: ConnectionState) => void;
  /** ms between heartbeat pings */
  heartbeatMs?: number;
  /** initial reconnect backoff, doubled each attempt up to maxBackoffMs */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

/**
 * A small reconnecting WebSocket wrapper with a typed protocol, an outbound
 * queue (messages sent while disconnected are flushed on reconnect), and a
 * heartbeat. Mirrors docs/PROTOCOL.md message shapes.
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private readonly opts: Required<WsClientOptions>;
  private outbox: ClientMsg[] = [];
  private heartbeat: number | null = null;
  private reconnectTimer: number | null = null;
  private attempts = 0;
  private closedByUser = false;

  constructor(options: WsClientOptions) {
    this.opts = {
      heartbeatMs: 15000,
      baseBackoffMs: 500,
      maxBackoffMs: 8000,
      onStateChange: () => {},
      ...options,
    };
  }

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  private open(): void {
    this.opts.onStateChange("connecting");
    const ws = new WebSocket(this.opts.url);
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.opts.onStateChange("open");
      this.flush();
      this.startHeartbeat();
    };

    ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(ev.data as string) as ServerMsg;
      } catch {
        return;
      }
      this.opts.onMessage(msg);
    };

    ws.onclose = () => {
      this.stopHeartbeat();
      this.opts.onStateChange("closed");
      if (!this.closedByUser) this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will follow; nothing to do here.
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const backoff = Math.min(
      this.opts.maxBackoffMs,
      this.opts.baseBackoffMs * 2 ** this.attempts,
    );
    this.attempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, backoff);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = window.setInterval(() => this.send({ t: "ping" }), this.opts.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat !== null) {
      window.clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private flush(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const pending = this.outbox;
    this.outbox = [];
    for (const msg of pending) this.ws.send(JSON.stringify(msg));
  }

  /** Send a message, queueing it if the socket is not open. */
  send(msg: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (msg.t !== "ping") {
      // never queue heartbeats; they are only meaningful live
      this.outbox.push(msg);
    }
  }

  close(): void {
    this.closedByUser = true;
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
