import { CPXStore } from "../cpx-store.ts";

export class CPXSchemeStore extends CPXStore {
  constructor() {
    super({ scheme: 'light dark' }, [
      (prop, val) => console.log(`[Mutation] ${prop} set to:`, val)
    ]);
  }

  override connectedCallback() {
    super.connectedCallback();
    // Sync scheme on initial load
    document.body.className = this.state.scheme as string;
  }

  setScheme(type: string) {
    this.state.scheme = type;
  }
}
customElements.define('cpx-scheme-store', CPXSchemeStore);