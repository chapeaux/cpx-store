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
 * Using Proxy for state, storage event for cross-tab, 
 * and CustomEvent for internal broadcasting.
 */
export class AppStore extends CPXStore {
  constructor() {
    // 1. Define initial state and optional middleware
    const initialState = { 
      count: 0,  
      user: { name: 'Guest', role: 'visitor' } 
    };
    
    // Pass config to BaseStore: super(initialState, middlewareArray)
    super(initialState, [
      (prop, val) => console.log(`[Mutation] ${prop} set to:`, val)
    ]);
    
    

    // 4. Cross-tab synchronization
    window.addEventListener('storage', (e) => {
      if (e.key === 'pda_demo') {
        this._isSyncing = true; // Set flag to prevent save loop
        const data = JSON.parse(e.newValue);
        // Use Object.assign to update our Proxy state
        Object.assign(this.state, data);
        this._isSyncing = false; // Reset flag
      }
    });
  }

  connectedCallback() {
    window.addEventListener('app:action', (e) => {
      const { type, payload } = e.detail;
      if (type === 'increment') this.state.count++;
      if (type === 'set-theme') this.state.theme = payload;
    });
  }

  _broadcast(prop, value) {
    // ONLY update the DOM if the theme property changed
    if (prop === 'all') {
      const newTheme = prop === 'all' ? value.theme : value;
      // Final guard: only touch the DOM if the class is actually different
      if (document.body.className !== newTheme) {
        document.body.className = newTheme;
      }
    }

    this.dispatchEvent(new CustomEvent('change', { 
      detail: { prop, value }, 
      bubbles: true, 
      composed: true 
    }));
  }
}
customElements.define('app-store', AppStore);