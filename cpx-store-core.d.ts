import { ReactiveState, ReactiveComputed } from './reactivity.ts';
import type { StorePlugin } from './types.ts';
type Constructor = new (...args: any[]) => any;
export interface CPXStoreBase {
    _state: Record<string, unknown>;
    _signals: Map<string, ReactiveState<unknown>>;
    _computedSignals: Map<string, ReactiveComputed<unknown>>;
    _plugins: StorePlugin[];
    _pendingChanges: Map<string, {
        old: unknown;
        val: unknown;
    }>;
    _changeHandlers: Set<(changes: Map<string, {
        old: unknown;
        val: unknown;
    }>) => void>;
    _flushScheduled: boolean;
    _batchDepth: number;
    _isSyncing: boolean;
    _initialized: boolean;
    state: Record<string, unknown>;
    _setup(initialState?: Record<string, unknown>, plugins?: StorePlugin[]): void;
    _resolveNestedPath(path: string): {
        parent: Record<string, unknown>;
        key: string;
    } | undefined;
    _setProperty(prop: string, value: unknown): void;
    _init(): void;
    _destroy(): void;
    use(plugin: StorePlugin): this;
    computed(name: string, fn: () => unknown): void;
    onChange(handler: (changes: Map<string, {
        old: unknown;
        val: unknown;
    }>) => void): () => void;
    _emitChanges(changes: Map<string, {
        old: unknown;
        val: unknown;
    }>): void;
    _scheduleFlush(): void;
    _flush(): void;
    batch(fn: () => void): void;
    transaction(fn: () => void): void;
    dispatch(action: (state: Record<string, unknown>) => Promise<void>): Promise<void>;
    sync(incoming: Record<string, unknown>): void;
    onSyncReceived(newState: Record<string, unknown>, oldState: Record<string, unknown>): void;
    undo(): void;
    redo(): void;
    toJSON(): Record<string, unknown>;
}
export declare function CPXStoreCoreMixin<T extends Constructor>(Base: T): T & (new (...args: any[]) => CPXStoreBase);
declare const CPXHeadlessBase: new (...args: any[]) => CPXStoreBase;
export declare class CPXStoreCore extends CPXHeadlessBase {
    constructor(initialState?: Record<string, unknown>, ...plugins: StorePlugin[]);
}
export type { StorePlugin } from './types.ts';
