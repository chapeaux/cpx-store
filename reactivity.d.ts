interface Trackable {
    _subscribers: Set<ReactiveComputed<unknown>>;
}
export declare class ReactiveState<T> implements Trackable {
    _value: T;
    _subscribers: Set<ReactiveComputed<unknown>>;
    constructor(value: T);
    get(): T;
    set(value: T): void;
}
export declare class ReactiveComputed<T> implements Trackable {
    _fn: () => T;
    _cache: T | undefined;
    _dirty: boolean;
    _deps: Set<Trackable>;
    _subscribers: Set<ReactiveComputed<unknown>>;
    constructor(fn: () => T);
    _markDirty(): void;
    _retrack(): void;
    get(): T;
}
export declare function untrack<T>(fn: () => T): T;
export {};
