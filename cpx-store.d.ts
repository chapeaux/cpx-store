export declare class CPXStore extends HTMLElement {
    _state: Record<string | symbol, unknown>;
    _history: string[];
    _pointer: number;
    _isInternalChange: boolean;
    _isSyncing: boolean;
    _middleware: Array<(prop: string | symbol, value: unknown, oldValue?: unknown) => void>;
    state: Record<string | symbol, unknown>;
    constructor(initialState?: {}, middleware?: Array<(prop: string | symbol, value: unknown, oldValue?: unknown) => void>);
    connectedCallback(): void;
    _broadcast(prop: any, value: any, eventName?: string): void;
    undo(): void;
    redo(): void;
    _applyHistory(): void;
}
