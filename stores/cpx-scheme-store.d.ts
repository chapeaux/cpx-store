import { CPXStore } from "../cpx-store.ts";
export declare class CPXSchemeStore extends CPXStore {
    constructor();
    connectedCallback(): void;
    setScheme(type: string): void;
}
