import { CPXStore } from "../cpx-store.ts";
export class CPXSchemeStore extends CPXStore {
    constructor() {
        super({ scheme: 'light dark' }, [
            (prop, val) => console.log(`[Mutation] ${prop} set to:`, val)
        ]);
    }
    connectedCallback() {
        super.connectedCallback();
        document.body.className = this.state.scheme;
    }
    setScheme(type) {
        this.state.scheme = type;
    }
}
customElements.define('cpx-scheme-store', CPXSchemeStore);
