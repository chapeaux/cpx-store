import { CPXStoreCoreMixin } from './cpx-store-core.ts';
import type { StorePlugin } from './types.ts';

const WebComponentBase = CPXStoreCoreMixin(HTMLElement);

export class CPXStore extends WebComponentBase {
  constructor(initialState: Record<string, unknown> = {}, ...plugins: StorePlugin[]) {
    super();
    this._setup(initialState, plugins);
  }

  connectedCallback() {
    this._init();

    this.onChange((changes) => {
      this.dispatchEvent(new CustomEvent('change', {
        detail: { changes: Object.fromEntries(changes) },
        bubbles: true
      }));

      globalThis.dispatchEvent(new CustomEvent('app-state-update', {
        detail: { store: this.tagName, changes: Object.fromEntries(changes) }
      }));
    });
  }

  disconnectedCallback() {
    this._destroy();
  }

  override async dispatch(action: (state: Record<string, unknown>) => Promise<void>) {
    this._batchDepth++;
    try {
      await action(this.state);
      this._batchDepth--;
      if (this._batchDepth === 0) this._flush();
    } catch (error) {
      this._batchDepth--;
      if (this._batchDepth === 0) this._flush();
      this.dispatchEvent(new CustomEvent('dispatch-error', {
        detail: { error }, bubbles: true
      }));
      throw error;
    }
  }
}

export type { StorePlugin } from './types.ts';
