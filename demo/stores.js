import { CPXStore } from '../src/cpx-store.ts';

export class UserStore extends CPXStore {
  constructor() {
    // 1. Initial State
    super({ name: 'Guest', preferences: {} }, [/* middleware */]);
  }

  // 2. Domain Actions
  updateName(newName) {
    this.state.name = newName;
  }
}
customElements.define('user-store', UserStore);

export class SchemeStore extends CPXStore {
  constructor() {
    super({ scheme: 'light dark' }, [
      (prop, val) => console.log(`[Mutation] ${prop} set to:`, val)
    ]);

    // Sync scheme on initial load
    document.body.className = this.state.scheme;
  }
  
  setScheme(type) {
    this.state.scheme = type;
  }
}
customElements.define('scheme-store', SchemeStore);

/**
 * THE APP STORE
 * Cross-tab sync is handled by the base class — just add persist="key"
 * in the HTML. Override onStorageChanged for side effects.
 */
export class AppStore extends CPXStore {
  constructor() {
    super(
      { count: 0, user: { name: 'Guest', role: 'visitor' } },
      [(prop, val) => console.log(`[Mutation] ${prop} set to:`, val)]
    );
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('app:action', (e) => {
      const { type, payload } = e.detail;
      if (type === 'increment') this.state.count++;
      if (type === 'set-theme') this.state.theme = payload;
    });
  }

  onStorageChanged(newState, oldState) {
    if (newState.theme !== oldState.theme) {
      document.body.className = newState.theme;
    }
  }

  _broadcast(prop, value) {
    if (prop === 'theme' && document.body.className !== value) {
      document.body.className = value;
    }

    this.dispatchEvent(new CustomEvent('change', {
      detail: { prop, value },
      bubbles: true,
      composed: true
    }));
  }
}
customElements.define('app-store', AppStore);