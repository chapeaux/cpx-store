import { type CPXStoreBase } from './cpx-store-core.ts';
import type { StorePlugin } from './types.ts';
declare const WebComponentBase: typeof HTMLElement & (new (...args: any[]) => CPXStoreBase);
export declare class CPXStore extends WebComponentBase {
    constructor(initialState?: Record<string, unknown>, ...plugins: StorePlugin[]);
    connectedCallback(): void;
    disconnectedCallback(): void;
    dispatch(action: (state: Record<string, unknown>) => Promise<void>): Promise<void>;
}
export type { StorePlugin } from './types.ts';
