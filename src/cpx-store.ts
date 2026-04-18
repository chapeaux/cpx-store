/**
 * THE BASE STORE
 */
export class CPXStore extends HTMLElement {
  _state: Record<string | symbol, unknown>;
  _history: string[];
  _pointer: number;
  _isInternalChange: boolean;
  _isSyncing: boolean;
  _storageHandler: ((e: StorageEvent) => void) | null;
  _middleware: Array<(prop: string | symbol, value: unknown, oldValue?: unknown) => void>;
  state!: Record<string | symbol, unknown>;

  constructor(initialState = {}, middleware: Array<(prop: string | symbol, value: unknown, oldValue?: unknown) => void> = []) {
    super();
    this._state = initialState;
    this._history = [JSON.stringify(initialState)];
    this._pointer = 0;
    this._isInternalChange = false;
    this._isSyncing = false;
    this._storageHandler = null;
    this._middleware = middleware;
  }

  connectedCallback() {
    const storageKey = this.getAttribute('persist');

    // Restore persisted state before Proxy creation (no events fire)
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) Object.assign(this._state, JSON.parse(saved));
      } catch (_) { /* ignore parse errors or unavailable localStorage */ }
    }

    this.state = new Proxy(this._state, {
      set: (target, prop, value) => {
        if (target[prop] === value) return true;

        // Run middleware
        this._middleware.forEach(fn => fn(prop, value, target[prop]));

        // Record history if not an internal "undo/redo"
        if (!this._isInternalChange) {
          // If we were in the middle of a redo chain and make a new change, 
          // we cut off the "future."
          this._history = this._history.slice(0, this._pointer + 1);
          this._history.push(JSON.stringify({ ...target, [prop]: value }));
          this._pointer++;
        }

        target[prop] = value;

        // Persist to Disk (Triggers 'storage' event in other tabs)
        if (storageKey && !this._isSyncing) {
          localStorage.setItem(storageKey, JSON.stringify(target));
        }

        this._broadcast(prop, value);
        return true;
      }
    });

    // Cross-tab sync: listen for storage changes from other tabs
    if (storageKey) {
      this._storageHandler = (e: StorageEvent) => {
        if (e.key !== storageKey) return;
        try {
          this.sync(JSON.parse(e.newValue!));
        } catch (_) { /* ignore parse errors */ }
      };
      window.addEventListener('storage', this._storageHandler);
    }
  }

  disconnectedCallback() {
    if (this._storageHandler) {
      window.removeEventListener('storage', this._storageHandler);
      this._storageHandler = null;
    }
  }

  sync(state: Record<string, unknown>) {
    this._isSyncing = true;
    const oldState = { ...this._state };
    Object.assign(this.state, state);
    this._isSyncing = false;
    this.onStorageChanged({ ...this._state }, oldState);
  }

  onStorageChanged(_newState: Record<string, unknown>, _oldState: Record<string, unknown>) {
    // Override in subclasses for side effects on cross-tab sync.
    // Called after state has been applied from another tab.
  }

  _broadcast(prop: string | symbol, value: unknown, eventName='app-state-update') {
    // 4. BROADCAST (Telling the World)
    // Local DOM event for components
    this.dispatchEvent(new CustomEvent('change', { 
        detail: { prop, value }, 
        bubbles: true 
    }));
    
    // Global Window event for legacy/external scripts
    globalThis.dispatchEvent(new CustomEvent(eventName, { 
        detail: { store: this.tagName, prop, value } 
    }));
  }

  undo() {
    if (this._pointer > 0) {
      this._pointer--;
      this._applyHistory();
    }
  }

  redo() {
    if (this._pointer < this._history.length - 1) {
      this._pointer++;
      this._applyHistory();
    }
  }

  _applyHistory() {
    this._isInternalChange = true;
    const snapshot = JSON.parse(this._history[this._pointer]);
    Object.assign(this.state, snapshot);
    this._isInternalChange = false;
  }
}