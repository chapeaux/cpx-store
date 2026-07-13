import type { SyncTransport, StateOperation } from '../types.ts';
export interface SSETransportOptions {
    apiUrl?: string;
    headers?: Record<string, string>;
}
export declare class SSETransport implements SyncTransport {
    private _eventsUrl;
    private _apiUrl;
    private _headers;
    private _eventSource;
    private _handler;
    private _queue;
    private _connected;
    private _intentionalClose;
    private _reconnectDelay;
    private _maxReconnectDelay;
    private _reconnectTimer;
    constructor(eventsUrl: string, options?: SSETransportOptions);
    send(op: StateOperation): void;
    onReceive(handler: (op: StateOperation) => void): void;
    connect(): Promise<void>;
    private _doConnect;
    private _doSend;
    private _flushQueue;
    private _scheduleReconnect;
    disconnect(): void;
}
