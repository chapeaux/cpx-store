/**
 * @module
 * Server-Sent Events transport for unidirectional server-to-client state synchronization
 * with optional HTTP POST for outbound operations.
 */
import type { SyncTransport, StateOperation } from '../types.ts';

/** Configuration for the SSE transport. */
export interface SSETransportOptions {
  /** URL to POST outbound operations to. If omitted, send() is a no-op (receive-only mode). */
  apiUrl?: string;
  /** Additional headers sent with outbound POST requests. */
  headers?: Record<string, string>;
}

/** SSE transport with automatic reconnection (exponential backoff) and outbound message queueing. */
export class SSETransport implements SyncTransport {
  private _eventsUrl: string;
  private _apiUrl: string | undefined;
  private _headers: Record<string, string>;
  private _eventSource: EventSource | null = null;
  private _handler: ((op: StateOperation) => void) | null = null;
  private _queue: StateOperation[] = [];
  private _connected = false;
  private _intentionalClose = false;
  private _reconnectDelay = 1000;
  private _maxReconnectDelay = 30000;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(eventsUrl: string, options: SSETransportOptions = {}) {
    this._eventsUrl = eventsUrl;
    this._apiUrl = options.apiUrl;
    this._headers = options.headers ?? {};
  }

  send(op: StateOperation): void {
    if (!this._apiUrl) return;

    if (this._connected) {
      this._doSend(op);
    } else {
      this._queue.push(op);
    }
  }

  onReceive(handler: (op: StateOperation) => void): void {
    this._handler = handler;
  }

  connect(): Promise<void> {
    this._intentionalClose = false;
    this._reconnectDelay = 1000;
    return this._doConnect();
  }

  private _doConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this._eventSource = new EventSource(this._eventsUrl);
      } catch (e) {
        reject(e);
        return;
      }

      this._eventSource.onopen = () => {
        this._connected = true;
        this._reconnectDelay = 1000;
        this._flushQueue();
        resolve();
      };

      this._eventSource.onmessage = (event: MessageEvent) => {
        if (this._handler) {
          try {
            const op = JSON.parse(event.data as string) as StateOperation;
            this._handler(op);
          } catch { /* ignore malformed messages */ }
        }
      };

      this._eventSource.onerror = () => {
        const wasConnected = this._connected;
        this._connected = false;

        if (this._eventSource) {
          this._eventSource.close();
          this._eventSource = null;
        }

        if (!wasConnected) {
          reject(new Error('SSE connection failed'));
        } else if (!this._intentionalClose) {
          this._scheduleReconnect();
        }
      };
    });
  }

  private _doSend(op: StateOperation): void {
    fetch(this._apiUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this._headers },
      body: JSON.stringify(op),
    }).catch(() => {
      this._queue.push(op);
    });
  }

  private _flushQueue(): void {
    while (this._queue.length > 0 && this._connected && this._apiUrl) {
      const op = this._queue.shift()!;
      this._doSend(op);
    }
  }

  private _scheduleReconnect(): void {
    if (this._intentionalClose) return;

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._doConnect().catch(() => {
        // onerror handler will schedule another reconnect
      });
    }, this._reconnectDelay);

    this._reconnectDelay = Math.min(
      this._reconnectDelay * 2,
      this._maxReconnectDelay,
    );
  }

  disconnect(): void {
    this._intentionalClose = true;
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = null;
    }
    this._connected = false;
  }
}
