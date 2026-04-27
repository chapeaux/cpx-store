import { expect } from "@esm-bundle/chai";
import { CPXStore } from "../src/cpx-store.ts";
import { middlewarePlugin } from "../src/plugins/middleware.ts";
import { historyPlugin } from "../src/plugins/history.ts";
import { persistencePlugin } from "../src/plugins/persistence.ts";

const nextTick = () => new Promise<void>(r => queueMicrotask(r));

// --- Test Stores ---

class TestStore extends CPXStore {
  constructor() {
    super({ count: 0 }, historyPlugin());
  }
}
if (!customElements.get("test-store")) {
  customElements.define("test-store", TestStore);
}

class MiddlewareTestStore extends CPXStore {
  constructor() {
    super({ count: 0 },
      middlewarePlugin([(prop, val) => {
        if (prop === 'blocked') throw new Error('blocked');
      }]),
      historyPlugin()
    );
  }
}
if (!customElements.get("mw-test-store")) {
  customElements.define("mw-test-store", MiddlewareTestStore);
}

class PersistTestStore extends CPXStore {
  constructor() {
    super({ count: 0, theme: 'light' }, historyPlugin(), persistencePlugin());
  }
}
if (!customElements.get("persist-test-store")) {
  customElements.define("persist-test-store", PersistTestStore);
}

class CallbackTestStore extends CPXStore {
  lastNewState: Record<string, unknown> | null = null;
  lastOldState: Record<string, unknown> | null = null;
  callbackCount = 0;

  constructor() {
    super({ count: 0, theme: 'light' }, persistencePlugin());
  }

  override onSyncReceived(newState: Record<string, unknown>, oldState: Record<string, unknown>) {
    this.lastNewState = newState;
    this.lastOldState = oldState;
    this.callbackCount++;
  }
}
if (!customElements.get("callback-test-store")) {
  customElements.define("callback-test-store", CallbackTestStore);
}

// --- Core State & Reactivity ---

describe("CPXStore: Core State", () => {

  it("should initialize state and trigger proxy updates", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    expect(store.state.count).to.equal(0);
    store.state.count = 10;
    expect(store.state.count).to.equal(10);

    store.remove();
  });

  it("should skip update when value is unchanged", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    store.state.count = 0;
    // No pending changes should exist for a no-op set
    expect(store._pendingChanges.size).to.equal(0);

    store.remove();
  });

  it("should handle delete on state properties", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    store.state.count = 5;
    delete (store.state as any).count;
    expect(store.state.count).to.be.undefined;

    store.remove();
  });

  it("should report computed keys in 'has' and 'ownKeys'", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    store.computed('double', () => (store.state.count as number) * 2);

    expect('double' in store.state).to.be.true;
    expect(Object.keys(store.state)).to.include('double');

    store.remove();
  });
});

// --- Microtask-Coalesced Events ---

describe("CPXStore: Events", () => {

  it("should dispatch coalesced change event after microtask", async () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    let eventDetail: any = null;
    store.addEventListener("change", (e: any) => {
      eventDetail = e.detail;
    });

    store.state.count = 42;
    expect(eventDetail).to.be.null;

    await nextTick();
    expect(eventDetail).to.exist;
    expect(eventDetail.changes.count.val).to.equal(42);
    expect(eventDetail.changes.count.old).to.equal(0);

    store.remove();
  });

  it("should coalesce multiple mutations into one event", async () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    let eventCount = 0;
    store.addEventListener("change", () => { eventCount++; });

    store.state.count = 1;
    store.state.count = 2;
    store.state.count = 3;

    await nextTick();
    expect(eventCount).to.equal(1);

    store.remove();
  });

  it("should dispatch global app-state-update event", async () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    let globalDetail: any = null;
    const handler = (e: any) => { globalDetail = e.detail; };
    globalThis.addEventListener("app-state-update", handler);

    store.state.count = 99;
    await nextTick();

    expect(globalDetail).to.exist;
    expect(globalDetail.store).to.equal("TEST-STORE");
    expect(globalDetail.changes.count.val).to.equal(99);

    globalThis.removeEventListener("app-state-update", handler);
    store.remove();
  });

  it("should not fire event when mutations cancel out", async () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    let eventFired = false;
    store.addEventListener("change", () => { eventFired = true; });

    store.state.count = 5;
    store.state.count = 0; // back to original

    await nextTick();
    expect(eventFired).to.be.false;

    store.remove();
  });
});

// --- Batch & Transaction ---

describe("CPXStore: Batch & Transaction", () => {

  it("should flush synchronously at end of batch", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    let eventDetail: any = null;
    store.addEventListener("change", (e: any) => { eventDetail = e.detail; });

    store.batch(() => {
      store.state.count = 10;
      store.state.count = 20;
    });

    expect(eventDetail).to.exist;
    expect(eventDetail.changes.count.old).to.equal(0);
    expect(eventDetail.changes.count.val).to.equal(20);

    store.remove();
  });

  it("should support nested batches", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    let eventCount = 0;
    store.addEventListener("change", () => { eventCount++; });

    store.batch(() => {
      store.state.count = 1;
      store.batch(() => {
        store.state.count = 2;
      });
      // inner batch should not flush yet
      expect(eventCount).to.equal(0);
      store.state.count = 3;
    });

    expect(eventCount).to.equal(1);
    expect(store.state.count).to.equal(3);

    store.remove();
  });

  it("should rollback on transaction error", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    store.state.count = 10;

    let eventFired = false;
    store.addEventListener("change", () => { eventFired = true; });

    try {
      store.transaction(() => {
        store.state.count = 999;
        throw new Error('rollback');
      });
    } catch (e: any) {
      expect(e.message).to.equal('rollback');
    }

    expect(store.state.count).to.equal(10);
    expect(eventFired).to.be.false;

    store.remove();
  });
});

// --- Middleware ---

describe("CPXStore: Middleware", () => {

  it("should execute middleware on mutation", () => {
    let log: string[] = [];

    class MwLogStore extends CPXStore {
      constructor() {
        super({ count: 0 },
          middlewarePlugin([(prop, val) => { log.push(`${prop}=${val}`); }])
        );
      }
    }
    const tag = "mw-log-" + Math.random().toString(36).slice(2);
    customElements.define(tag, MwLogStore);
    const store = document.createElement(tag) as MwLogStore;
    document.body.appendChild(store);

    store.state.count = 5;
    expect(log).to.deep.equal(['count=5']);

    store.remove();
  });

  it("should support filtered middleware", () => {
    let log: string[] = [];

    class MwFilterStore extends CPXStore {
      constructor() {
        super({ count: 0, name: 'a' },
          middlewarePlugin([
            { filter: 'count', fn: (_prop, val) => { log.push(`count:${val}`); } },
            { filter: /^name/, fn: (_prop, val) => { log.push(`name:${val}`); } }
          ])
        );
      }
    }
    const tag = "mw-filter-" + Math.random().toString(36).slice(2);
    customElements.define(tag, MwFilterStore);
    const store = document.createElement(tag) as MwFilterStore;
    document.body.appendChild(store);

    store.state.count = 5;
    store.state.name = 'b';

    expect(log).to.deep.equal(['count:5', 'name:b']);

    store.remove();
  });
});

// --- History: Undo/Redo ---

describe("CPXStore: History", () => {

  it("should undo and redo state changes", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    store.state.count = 1;
    store.state.count = 2;
    expect(store.state.count).to.equal(2);

    store.undo();
    expect(store.state.count).to.equal(1);

    store.redo();
    expect(store.state.count).to.equal(2);

    store.remove();
  });

  it("should undo multiple changes in reverse order", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    store.state.count = 1;
    store.state.count = 2;
    store.state.count = 3;

    store.undo();
    expect(store.state.count).to.equal(2);
    store.undo();
    expect(store.state.count).to.equal(1);
    store.undo();
    expect(store.state.count).to.equal(0);
    store.undo();
    expect(store.state.count).to.equal(0);

    store.remove();
  });

  it("should discard forward history on new change after undo", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    store.state.count = 1;
    store.state.count = 2;

    store.undo();
    expect(store.state.count).to.equal(1);

    store.state.count = 5;
    store.redo();
    expect(store.state.count).to.equal(5);

    store.remove();
  });

  it("should limit history with maxHistory", () => {
    class CappedStore extends CPXStore {
      constructor() {
        super({ count: 0 }, historyPlugin({ maxHistory: 3 }));
      }
    }
    const tag = "capped-store-" + Math.random().toString(36).slice(2);
    customElements.define(tag, CappedStore);
    const store = document.createElement(tag) as CappedStore;
    document.body.appendChild(store);

    store.state.count = 1;
    store.state.count = 2;
    store.state.count = 3;
    store.state.count = 4;

    store.undo();
    expect(store.state.count).to.equal(3);
    store.undo();
    expect(store.state.count).to.equal(2);
    store.undo();
    expect(store.state.count).to.equal(1);
    store.undo(); // at limit
    expect(store.state.count).to.equal(1);

    store.remove();
  });

  it("should not record history for strategy 'none'", () => {
    class NoHistoryStore extends CPXStore {
      constructor() {
        super({ cursor: 0, content: '' },
          historyPlugin({ strategies: { cursor: 'none' } })
        );
      }
    }
    const tag = "nohist-" + Math.random().toString(36).slice(2);
    customElements.define(tag, NoHistoryStore);
    const store = document.createElement(tag) as NoHistoryStore;
    document.body.appendChild(store);

    store.state.cursor = 10;
    store.state.cursor = 20;
    store.state.content = 'hello';

    store.undo();
    expect(store.state.content).to.equal('');
    // cursor changes were not recorded, so undo only affects content
    expect(store.state.cursor).to.equal(20);

    store.remove();
  });
});

// --- Computed / Derived State ---

describe("CPXStore: Computed State", () => {

  it("should return the computed value", () => {
    class ComputedStore extends CPXStore {
      constructor() {
        super({ price: 10, qty: 2 });
      }
      connectedCallback() {
        super.connectedCallback();
        this.computed('total', () => {
          return (this.state.price as number) * (this.state.qty as number);
        });
      }
    }
    const tag = "comp-store-" + Math.random().toString(36).slice(2);
    customElements.define(tag, ComputedStore);
    const store = document.createElement(tag) as ComputedStore;
    document.body.appendChild(store);

    expect(store.state.total).to.equal(20);

    store.remove();
  });

  it("should recompute when a dependency changes", () => {
    class ComputedStore extends CPXStore {
      constructor() {
        super({ price: 10, qty: 2 }, historyPlugin());
      }
      connectedCallback() {
        super.connectedCallback();
        this.computed('total', () => {
          return (this.state.price as number) * (this.state.qty as number);
        });
      }
    }
    const tag = "comp-recomp-" + Math.random().toString(36).slice(2);
    customElements.define(tag, ComputedStore);
    const store = document.createElement(tag) as ComputedStore;
    document.body.appendChild(store);

    store.state.price = 5;
    expect(store.state.total).to.equal(10);

    store.state.qty = 4;
    expect(store.state.total).to.equal(20);

    store.remove();
  });

  it("should cache and not recompute for non-dependency changes", () => {
    let callCount = 0;
    class ComputedStore extends CPXStore {
      constructor() {
        super({ price: 10, qty: 2, unrelated: 'x' });
      }
      connectedCallback() {
        super.connectedCallback();
        this.computed('derived', () => {
          callCount++;
          return (this.state.price as number) * 10;
        });
      }
    }
    const tag = "comp-cache-" + Math.random().toString(36).slice(2);
    customElements.define(tag, ComputedStore);
    const store = document.createElement(tag) as ComputedStore;
    document.body.appendChild(store);

    expect(store.state.derived).to.equal(100);
    expect(callCount).to.equal(1);

    expect(store.state.derived).to.equal(100);
    expect(callCount).to.equal(1);

    store.state.qty = 99;
    expect(store.state.derived).to.equal(100);
    expect(callCount).to.equal(1);

    store.state.price = 3;
    expect(store.state.derived).to.equal(30);
    expect(callCount).to.equal(2);

    store.remove();
  });

  it("should silently ignore writes to computed properties", () => {
    class ComputedStore extends CPXStore {
      constructor() {
        super({ price: 10, qty: 2 });
      }
      connectedCallback() {
        super.connectedCallback();
        this.computed('total', () => {
          return (this.state.price as number) * (this.state.qty as number);
        });
      }
    }
    const tag = "comp-nowrite-" + Math.random().toString(36).slice(2);
    customElements.define(tag, ComputedStore);
    const store = document.createElement(tag) as ComputedStore;
    document.body.appendChild(store);

    store.state.total = 999;
    expect(store.state.total).to.equal(20);

    store.remove();
  });

  it("should recompute correctly after undo", () => {
    class ComputedStore extends CPXStore {
      constructor() {
        super({ price: 10, qty: 2 }, historyPlugin());
      }
      connectedCallback() {
        super.connectedCallback();
        this.computed('total', () => {
          return (this.state.price as number) * (this.state.qty as number);
        });
      }
    }
    const tag = "comp-undo-" + Math.random().toString(36).slice(2);
    customElements.define(tag, ComputedStore);
    const store = document.createElement(tag) as ComputedStore;
    document.body.appendChild(store);

    expect(store.state.total).to.equal(20);
    store.state.price = 5;
    expect(store.state.total).to.equal(10);

    store.undo();
    expect(store.state.total).to.equal(20);

    store.remove();
  });

  it("should support transitive computed dependencies", () => {
    class TransitiveStore extends CPXStore {
      constructor() {
        super({ base: 2 });
      }
      connectedCallback() {
        super.connectedCallback();
        this.computed('doubled', () => (this.state.base as number) * 2);
        this.computed('quadrupled', () => (this.state.doubled as number) * 2);
      }
    }
    const tag = "comp-trans-" + Math.random().toString(36).slice(2);
    customElements.define(tag, TransitiveStore);
    const store = document.createElement(tag) as TransitiveStore;
    document.body.appendChild(store);

    expect(store.state.doubled).to.equal(4);
    expect(store.state.quadrupled).to.equal(8);

    store.state.base = 5;
    expect(store.state.doubled).to.equal(10);
    expect(store.state.quadrupled).to.equal(20);

    store.remove();
  });
});

// --- Async Dispatch ---

describe("CPXStore: Async Dispatch", () => {

  it("should apply state changes from an async action", async () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    await store.dispatch(async (state) => {
      state.count = 42;
    });

    expect(store.state.count).to.equal(42);

    store.remove();
  });

  it("should batch events during dispatch", async () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    let eventCount = 0;
    store.addEventListener("change", () => { eventCount++; });

    await store.dispatch(async (state) => {
      state.count = 1;
      state.count = 2;
      state.count = 3;
    });

    expect(eventCount).to.equal(1);

    store.remove();
  });

  it("should dispatch error event and reject on failure", async () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    let errorDetail: any = null;
    store.addEventListener('dispatch-error', (e: any) => {
      errorDetail = e.detail;
    });

    try {
      await store.dispatch(async () => {
        throw new Error('fetch failed');
      });
      expect.fail('should have thrown');
    } catch (e: any) {
      expect(e.message).to.equal('fetch failed');
    }

    expect(errorDetail).to.exist;
    expect(errorDetail.error.message).to.equal('fetch failed');

    store.remove();
  });

  it("should record history for state changes inside dispatch", async () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    await store.dispatch(async (state) => {
      state.count = 10;
      state.count = 20;
    });

    expect(store.state.count).to.equal(20);
    store.undo();
    expect(store.state.count).to.equal(10);
    store.undo();
    expect(store.state.count).to.equal(0);

    store.remove();
  });
});

// --- Persistence & Cross-Tab Sync ---

describe("CPXStore: Persistence", () => {

  afterEach(() => localStorage.clear());

  it("should restore state from localStorage on connect", () => {
    localStorage.setItem('test-persist', JSON.stringify({ count: 42, theme: 'dark' }));
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    expect(store.state.count).to.equal(42);
    expect(store.state.theme).to.equal('dark');

    store.remove();
  });

  it("should not restore if persist attribute is absent", () => {
    localStorage.setItem('test-persist', JSON.stringify({ count: 42 }));
    const store = document.createElement("persist-test-store") as PersistTestStore;
    document.body.appendChild(store);

    expect(store.state.count).to.equal(0);

    store.remove();
  });

  it("should handle corrupt localStorage data gracefully", () => {
    localStorage.setItem('test-persist', 'not-valid-json{{{');
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    expect(store.state.count).to.equal(0);

    store.remove();
  });

  it("should persist state to localStorage after flush", async () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    store.state.count = 77;
    await nextTick();

    expect(JSON.parse(localStorage.getItem('test-persist')!).count).to.equal(77);

    store.remove();
  });

  it("should persist synchronously when using batch", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    store.batch(() => {
      store.state.count = 55;
      store.state.theme = 'dark';
    });

    const saved = JSON.parse(localStorage.getItem('test-persist')!);
    expect(saved.count).to.equal(55);
    expect(saved.theme).to.equal('dark');

    store.remove();
  });

  it("should update state on storage event for matching key", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'test-persist',
      newValue: JSON.stringify({ count: 77, theme: 'ocean' }),
    }));

    expect(store.state.count).to.equal(77);
    expect(store.state.theme).to.equal('ocean');

    store.remove();
  });

  it("should ignore storage events for different keys", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'other-key',
      newValue: JSON.stringify({ count: 999 }),
    }));

    expect(store.state.count).to.equal(0);

    store.remove();
  });

  it("should not write back to localStorage during sync", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    store.batch(() => { store.state.count = 5; });
    expect(JSON.parse(localStorage.getItem('test-persist')!).count).to.equal(5);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'test-persist',
      newValue: JSON.stringify({ count: 100, theme: 'dark' }),
    }));

    expect(store.state.count).to.equal(100);
    expect(JSON.parse(localStorage.getItem('test-persist')!).count).to.equal(5);

    store.remove();
  });

  it("should call onSyncReceived with new and old state", () => {
    const store = document.createElement("callback-test-store") as CallbackTestStore;
    store.setAttribute('persist', 'cb-test');
    document.body.appendChild(store);

    store.batch(() => { store.state.count = 10; });

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'cb-test',
      newValue: JSON.stringify({ count: 50, theme: 'sunset' }),
    }));

    expect(store.callbackCount).to.equal(1);
    expect(store.lastNewState!.count).to.equal(50);
    expect(store.lastNewState!.theme).to.equal('sunset');
    expect(store.lastOldState!.count).to.equal(10);
    expect(store.lastOldState!.theme).to.equal('light');

    store.remove();
  });

  it("should still dispatch change events during sync", async () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    let eventFired = false;
    store.addEventListener("change", () => { eventFired = true; });

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'test-persist',
      newValue: JSON.stringify({ count: 42 }),
    }));

    expect(eventFired).to.be.true;

    store.remove();
  });
});

// --- sync() method ---

describe("CPXStore: sync()", () => {

  afterEach(() => localStorage.clear());

  it("should apply state and call onSyncReceived", () => {
    const store = document.createElement("callback-test-store") as CallbackTestStore;
    document.body.appendChild(store);

    store.batch(() => { store.state.count = 10; });

    store.sync({ count: 77, theme: 'ocean' });

    expect(store.state.count).to.equal(77);
    expect(store.state.theme).to.equal('ocean');
    expect(store.callbackCount).to.equal(1);
    expect(store.lastNewState!.count).to.equal(77);
    expect(store.lastOldState!.count).to.equal(10);

    store.remove();
  });

  it("should not write back to localStorage during sync", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'sync-test');
    document.body.appendChild(store);

    store.batch(() => { store.state.count = 5; });
    expect(JSON.parse(localStorage.getItem('sync-test')!).count).to.equal(5);

    store.sync({ count: 200, theme: 'dark' });

    expect(store.state.count).to.equal(200);
    expect(JSON.parse(localStorage.getItem('sync-test')!).count).to.equal(5);

    store.remove();
  });

  it("should dispatch change events", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    document.body.appendChild(store);

    let eventFired = false;
    store.addEventListener("change", () => { eventFired = true; });

    store.sync({ count: 42, theme: 'sunset' });

    expect(eventFired).to.be.true;

    store.remove();
  });
});

// --- Reactivity System ---

describe("CPXStore: Reactivity", () => {

  it("should auto-track computed dependencies (no deps array)", () => {
    class ReactiveStore extends CPXStore {
      constructor() {
        super({ a: 1, b: 2, c: 3 });
      }
      connectedCallback() {
        super.connectedCallback();
        this.computed('sum', () => {
          return (this.state.a as number) + (this.state.b as number);
        });
      }
    }
    const tag = "reactive-" + Math.random().toString(36).slice(2);
    customElements.define(tag, ReactiveStore);
    const store = document.createElement(tag) as ReactiveStore;
    document.body.appendChild(store);

    expect(store.state.sum).to.equal(3);

    store.state.a = 10;
    expect(store.state.sum).to.equal(12);

    // c is not a dependency
    store.state.c = 100;
    expect(store.state.sum).to.equal(12);

    store.remove();
  });

  it("should handle conditional dependencies", () => {
    class CondStore extends CPXStore {
      constructor() {
        super({ useA: true, a: 10, b: 20 });
      }
      connectedCallback() {
        super.connectedCallback();
        this.computed('value', () => {
          return this.state.useA ? this.state.a : this.state.b;
        });
      }
    }
    const tag = "cond-" + Math.random().toString(36).slice(2);
    customElements.define(tag, CondStore);
    const store = document.createElement(tag) as CondStore;
    document.body.appendChild(store);

    expect(store.state.value).to.equal(10);

    store.state.useA = false;
    expect(store.state.value).to.equal(20);

    store.state.b = 30;
    expect(store.state.value).to.equal(30);

    store.remove();
  });
});
