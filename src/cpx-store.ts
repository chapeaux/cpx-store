/**
 * THE BASE STORE
 */
export class CPXStore extends HTMLElement {
  _state: Record<string | symbol, unknown>;
  _history: Array<{ prop: string | symbol; old: unknown; val: unknown }>;
  _pointer: number;
  _maxHistory: number;
  _isInternalChange: boolean;
  _isSyncing: boolean;
  _storageHandler: ((e: StorageEvent) => void) | null;
  _middleware: Array<(prop: string | symbol, value: unknown, oldValue?: unknown) => void>;
  _computed: Map<string, { deps: string[]; fn: () => unknown; cache: unknown; dirty: boolean }>;
  state!: Record<string | symbol, unknown>;

  constructor(
    initialState = {},
    middleware: Array<(prop: string | symbol, value: unknown, oldValue?: unknown) => void> = [],
    options: { maxHistory?: number } = {}
  ) {
    super();
    this._state = initialState;
    this._history = [];
    this._pointer = -1;
    this._maxHistory = options.maxHistory ?? 100;
    this._isInternalChange = false;
    this._isSyncing = false;
    this._storageHandler = null;
    this._middleware = middleware;
    this._computed = new Map();
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
      get: (target, prop) => {
        const c = this._computed.get(prop as string);
        if (c) {
          if (c.dirty) { c.cache = c.fn(); c.dirty = false; }
          return c.cache;
        }
        return target[prop];
      },
      set: (target, prop, value) => {
        if (this._computed.has(prop as string)) return true;
        if (target[prop] === value) return true;

        this._middleware.forEach(fn => fn(prop, value, target[prop]));

        if (!this._isInternalChange) {
          this._history = this._history.slice(0, this._pointer + 1);
          this._history.push({ prop, old: target[prop], val: value });
          this._pointer++;
          if (this._maxHistory > 0 && this._history.length > this._maxHistory) {
            this._history.shift();
            this._pointer--;
          }
        }

        target[prop] = value;

        this._computed.forEach(c => {
          if (c.deps.includes(prop as string)) c.dirty = true;
        });

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
    if (this._pointer >= 0) {
      const d = this._history[this._pointer];
      this._isInternalChange = true;
      this.state[d.prop] = d.old;
      this._isInternalChange = false;
      this._pointer--;
    }
  }

  redo() {
    if (this._pointer < this._history.length - 1) {
      this._pointer++;
      const d = this._history[this._pointer];
      this._isInternalChange = true;
      this.state[d.prop] = d.val;
      this._isInternalChange = false;
    }
  }

  computed(name: string, deps: string[], fn: () => unknown) {
    this._computed.set(name, { deps, fn, cache: undefined, dirty: true });
  }

  async dispatch(action: (state: Record<string | symbol, unknown>) => Promise<void>) {
    try {
      await action(this.state);
    } catch (error) {
      this.dispatchEvent(new CustomEvent('dispatch-error', { detail: { error }, bubbles: true }));
      throw error;
    }
  }
}