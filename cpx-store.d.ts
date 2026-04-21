export declare class CPXStore extends HTMLElement {
    _state: Record<string | symbol, unknown>;
    _history: Array<{
        prop: string | symbol;
        old: unknown;
        val: unknown;
    }>;
    _pointer: number;
    _maxHistory: number;
    _isInternalChange: boolean;
    _isSyncing: boolean;
    _storageHandler: ((e: StorageEvent) => void) | null;
    _middleware: Array<(prop: string | symbol, value: unknown, oldValue?: unknown) => void>;
    _computed: Map<string, {
        deps: string[];
        fn: () => unknown;
        cache: unknown;
        dirty: boolean;
    }>;
    state: Record<string | symbol, unknown>;
    constructor(initialState?: {}, middleware?: Array<(prop: string | symbol, value: unknown, oldValue?: unknown) => void>, options?: {
        maxHistory?: number;
    });
    connectedCallback(): void;
    disconnectedCallback(): void;
    sync(state: Record<string, unknown>): void;
    onStorageChanged(_newState: Record<string, unknown>, _oldState: Record<string, unknown>): void;
    _broadcast(prop: string | symbol, value: unknown, eventName?: string): void;
    undo(): void;
    redo(): void;
    computed(name: string, deps: string[], fn: () => unknown): void;
    dispatch(action: (state: Record<string | symbol, unknown>) => Promise<void>): Promise<void>;
}
