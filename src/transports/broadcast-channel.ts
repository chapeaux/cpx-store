import type { SyncTransport, StateOperation } from '../types.ts';

export class BroadcastChannelTransport implements SyncTransport {
  private _channelName: string;
  private _channel: BroadcastChannel | null = null;
  private _handler: ((op: StateOperation) => void) | null = null;

  constructor(channelName: string) {
    this._channelName = channelName;
  }

  send(op: StateOperation): void {
    if (!this._channel) return;
    this._channel.postMessage(op);
  }

  onReceive(handler: (op: StateOperation) => void): void {
    this._handler = handler;
  }

  connect(): Promise<void> {
    this._channel = new BroadcastChannel(this._channelName);
    this._channel.onmessage = (event: MessageEvent) => {
      if (this._handler) {
        this._handler(event.data as StateOperation);
      }
    };
    return Promise.resolve();
  }

  disconnect(): void {
    if (this._channel) {
      this._channel.close();
      this._channel = null;
    }
  }
}
