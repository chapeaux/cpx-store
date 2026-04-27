export interface StorePlugin {
    name: string;
    onInit?(store: any): void;
    onBeforeSet?(prop: string, value: unknown, oldValue: unknown): boolean | void;
    onAfterSet?(prop: string, value: unknown, oldValue: unknown): void;
    onGet?(prop: string): {
        handled: boolean;
        value?: unknown;
    } | void;
    onFlush?(changes: Map<string, {
        old: unknown;
        val: unknown;
    }>): void;
    onDestroy?(): void;
}
export type HistoryStrategy = 'snapshot' | 'patch' | 'none';
export interface HistoryEntry {
    prop: string;
    strategy: HistoryStrategy;
    old?: unknown;
    val?: unknown;
    forwardPatch?: unknown;
    reversePatch?: unknown;
    checkpointIndex?: number;
}
export interface MiddlewareEntry {
    filter?: string | RegExp | ((prop: string) => boolean);
    fn: (prop: string, value: unknown, oldValue?: unknown) => void;
}
export interface SyncTransport {
    send(op: StateOperation): void;
    onReceive(handler: (op: StateOperation) => void): void;
    connect(): Promise<void>;
    disconnect(): void;
}
export interface StateOperation {
    id: string;
    origin: string;
    timestamp: number;
    prop: string;
    type: 'set' | 'patch';
    value?: unknown;
    patch?: unknown;
}
