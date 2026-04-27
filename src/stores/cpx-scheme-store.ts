import { CPXStore } from "../cpx-store.ts";
import { middlewarePlugin } from "../plugins/middleware.ts";

/** Example store that manages a light/dark color scheme preference with logging middleware. */
export class CPXSchemeStore extends CPXStore {
  constructor() {
    super(
      { scheme: 'light dark' },
      middlewarePlugin([
        (prop, val) => console.log(`[Mutation] ${String(prop)} set to:`, val)
      ])
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    document.body.className = this.state.scheme as string;
  }

  setScheme(type: string) {
    this.state.scheme = type;
  }
}
customElements.define('cpx-scheme-store', CPXSchemeStore);
