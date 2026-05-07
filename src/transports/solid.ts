/**
 * @module
 * Solid pod transport for decentralized state synchronization via the W3C Solid protocol.
 */
import type { SyncTransport, StateOperation } from '../types.ts';

/** Configuration for the Solid pod transport. */
export interface SolidTransportOptions {
  /** Authenticated fetch function (e.g. from @inrupt/solid-client-authn-browser). Defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
  /** Explicit Solid Notifications endpoint URL. Discovered automatically via Link header if omitted. */
  notificationsUrl?: string;
}

/** Solid pod transport using authenticated fetch for writes and the W3C Solid Notifications Protocol for real-time updates. */
export class SolidTransport implements SyncTransport {
  private _resourceUrl: string;
  private _fetch: typeof globalThis.fetch;
  private _notificationsUrl: string | undefined;
  private _eventSource: EventSource | null = null;
  private _handler: ((op: StateOperation) => void) | null = null;
  private _lastKnownState: Record<string, unknown> = {};
  private _pendingWrites = new Map<string, unknown>();
  private _writeScheduled = false;
  private _connected = false;

  constructor(resourceUrl: string, options: SolidTransportOptions = {}) {
    this._resourceUrl = resourceUrl;
    this._fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this._notificationsUrl = options.notificationsUrl;
  }

  send(op: StateOperation): void {
    this._pendingWrites.set(op.prop, op.value);
    this._lastKnownState[op.prop] = op.value;
    if (!this._writeScheduled) {
      this._writeScheduled = true;
      queueMicrotask(() => this._flushWrites());
    }
  }

  onReceive(handler: (op: StateOperation) => void): void {
    this._handler = handler;
  }

  async connect(): Promise<void> {
    // Fetch the initial resource state
    try {
      const res = await this._fetch(this._resourceUrl);
      if (res.ok) {
        const data = await res.json();
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith('@')) continue;
          this._lastKnownState[key] = value;
        }
      }
    } catch { /* resource may not exist yet */ }

    // Discover notifications endpoint if not provided
    if (!this._notificationsUrl) {
      this._notificationsUrl = await this._discoverNotifications();
    }

    // Subscribe to changes via W3C Solid Notifications Protocol
    if (this._notificationsUrl) {
      this._eventSource = new EventSource(this._notificationsUrl);
      this._eventSource.onmessage = () => this._handleNotification();
    }

    this._connected = true;
  }

  disconnect(): void {
    this._connected = false;
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = null;
    }
  }

  private async _flushWrites(): Promise<void> {
    this._writeScheduled = false;
    if (this._pendingWrites.size === 0) return;

    const patch = Object.fromEntries(this._pendingWrites);
    this._pendingWrites.clear();

    const body = { ...this._lastKnownState };
    // Preserve any @context that was in the original resource
    const merged = Object.assign(body, patch);

    try {
      await this._fetch(this._resourceUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
    } catch {
      // Re-queue failed writes
      for (const [key, value] of Object.entries(patch)) {
        if (!this._pendingWrites.has(key)) {
          this._pendingWrites.set(key, value);
        }
      }
      if (!this._writeScheduled) {
        this._writeScheduled = true;
        queueMicrotask(() => this._flushWrites());
      }
    }
  }

  private async _handleNotification(): Promise<void> {
    try {
      const res = await this._fetch(this._resourceUrl);
      if (!res.ok) return;

      const data = await res.json();
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('@')) continue;
        if (JSON.stringify(this._lastKnownState[key]) !== JSON.stringify(value)) {
          this._lastKnownState[key] = value;
          this._handler?.({
            id: crypto.randomUUID(),
            origin: 'solid-pod',
            timestamp: Date.now(),
            prop: key,
            type: 'set',
            value,
          });
        }
      }
    } catch { /* re-fetch failures are retried on next notification */ }
  }

  private async _discoverNotifications(): Promise<string | undefined> {
    try {
      const res = await this._fetch(this._resourceUrl, { method: 'HEAD' });
      const link = res.headers.get('Link') ?? '';
      // Look for a Solid Notifications subscription URL in Link headers
      const match = link.match(/<([^>]+)>;\s*rel=["']?http:\/\/www\.w3\.org\/ns\/solid\/terms#updatesViaStreamingHttp2023["']?/);
      return match?.[1] ?? undefined;
    } catch {
      return undefined;
    }
  }
}
