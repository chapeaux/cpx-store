import { expect } from "@esm-bundle/chai";
import { CPXStore } from "../src/cpx-store.ts";

// Define a test-specific store
class TestStore extends CPXStore {
  constructor() {
    super({ count: 0 });
  }
}

// Only define once to avoid conflicts
if (!customElements.get("test-store")) {
  customElements.define("test-store", TestStore);
}

describe("CPXStore: Infrastructure & Logic", () => {

  it("should initialize state and trigger proxy updates", () => {
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);

    expect(store.state.count).to.equal(0);
    store.state.count = 10;
    expect(store.state.count).to.equal(10);

    store.remove();
  });

  it("should execute middleware in order", () => {
    let middlewareFired = false;
    const store = new TestStore();
    // @ts-ignore: Accessing internal middleware for testing
    store._middleware = [(prop, val) => {
      if (prop === "count" && val === 5) middlewareFired = true;
    }];

    store.connectedCallback();
    store.state.count = 5;

    expect(middlewareFired).to.be.true;
  });

  it("should handle Undo/Redo history", () => {
    const store = new TestStore();
    store.connectedCallback();

    store.state.count = 1;
    store.state.count = 2;
    expect(store.state.count).to.equal(2);

    store.undo();
    expect(store.state.count).to.equal(1);

    store.redo();
    expect(store.state.count).to.equal(2);
  });

  it("should undo multiple changes in reverse order", () => {
    const store = new TestStore();
    store.connectedCallback();

    store.state.count = 1;
    store.state.count = 2;
    store.state.count = 3;

    store.undo();
    expect(store.state.count).to.equal(2);
    store.undo();
    expect(store.state.count).to.equal(1);
    store.undo();
    expect(store.state.count).to.equal(0);
    store.undo(); // no-op at initial state
    expect(store.state.count).to.equal(0);
  });

  it("should discard forward history on new change after undo", () => {
    const store = new TestStore();
    store.connectedCallback();

    store.state.count = 1;
    store.state.count = 2;

    store.undo();
    expect(store.state.count).to.equal(1);

    store.state.count = 5;
    store.redo(); // no-op — future was discarded
    expect(store.state.count).to.equal(5);
  });

  it("should dispatch 'change' events on mutation", () => {
    const store = new TestStore();
    store.connectedCallback();

    let eventDetail: any = null;
    store.addEventListener("change", (e: any) => {
      eventDetail = e.detail;
    });

    store.state.count = 42;
    expect(eventDetail).to.exist;
    expect(eventDetail.prop).to.equal("count");
    expect(eventDetail.value).to.equal(42);
  });
});

// --- Persistence & Cross-Tab Sync ---

class PersistTestStore extends CPXStore {
  constructor() {
    super({ count: 0, theme: 'light' });
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
    super({ count: 0, theme: 'light' });
  }

  override onStorageChanged(newState: Record<string, unknown>, oldState: Record<string, unknown>) {
    this.lastNewState = newState;
    this.lastOldState = oldState;
    this.callbackCount++;
  }
}
if (!customElements.get("callback-test-store")) {
  customElements.define("callback-test-store", CallbackTestStore);
}

describe("CPXStore: Persistence & Cross-Tab Sync", () => {

  afterEach(() => localStorage.clear());

  it("should restore state from localStorage on connectedCallback when persist is set", () => {
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

  it("should update state when a storage event fires for the matching key", () => {
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

  it("should ignore storage events for a different key", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'some-other-key',
      newValue: JSON.stringify({ count: 999 }),
    }));

    expect(store.state.count).to.equal(0);

    store.remove();
  });

  it("should not attach a storage listener when persist attribute is absent", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    document.body.appendChild(store);

    expect(store._storageHandler).to.be.null;

    store.remove();
  });

  it("should not write back to localStorage during sync", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    store.state.count = 5;
    expect(JSON.parse(localStorage.getItem('test-persist')!).count).to.equal(5);

    // Simulate a storage event — sync should NOT overwrite localStorage
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'test-persist',
      newValue: JSON.stringify({ count: 100, theme: 'dark' }),
    }));

    expect(store.state.count).to.equal(100);
    // localStorage should still have count:5 (written by us), not count:100 (from sync)
    expect(JSON.parse(localStorage.getItem('test-persist')!).count).to.equal(5);

    store.remove();
  });

  it("should call onStorageChanged with new and old state", () => {
    const store = document.createElement("callback-test-store") as CallbackTestStore;
    store.setAttribute('persist', 'cb-test');
    document.body.appendChild(store);

    store.state.count = 10;

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

  it("should not call onStorageChanged without persist attribute", () => {
    const store = document.createElement("callback-test-store") as CallbackTestStore;
    document.body.appendChild(store);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'cb-test',
      newValue: JSON.stringify({ count: 50 }),
    }));

    expect(store.callbackCount).to.equal(0);

    store.remove();
  });

  it("should remove storage listener on disconnectedCallback", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    store.setAttribute('persist', 'test-persist');
    document.body.appendChild(store);

    expect(store._storageHandler).to.not.be.null;

    store.remove();

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'test-persist',
      newValue: JSON.stringify({ count: 999 }),
    }));

    expect(store.state.count).to.equal(0);
    expect(store._storageHandler).to.be.null;
  });

  it("should still dispatch change events during cross-tab sync", () => {
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

// --- maxHistory cap ---

class CappedStore extends CPXStore {
  constructor() {
    super({ count: 0 }, [], { maxHistory: 3 });
  }
}
if (!customElements.get("capped-store")) {
  customElements.define("capped-store", CappedStore);
}

describe("CPXStore: maxHistory cap", () => {

  it("should limit history to maxHistory entries", () => {
    const store = new CappedStore();
    store.connectedCallback();

    store.state.count = 1;
    store.state.count = 2;
    store.state.count = 3;
    store.state.count = 4;

    expect(store._history.length).to.equal(3);
    // oldest entry (count=1) was dropped
    store.undo();
    expect(store.state.count).to.equal(3);
    store.undo();
    expect(store.state.count).to.equal(2);
    store.undo(); // oldest remaining
    expect(store.state.count).to.equal(1);
    store.undo(); // no-op — at limit
    expect(store.state.count).to.equal(1);
  });
});

// --- Computed / Derived State ---

class ComputedStore extends CPXStore {
  constructor() {
    super({ price: 10, qty: 2 });
  }
  connectedCallback() {
    super.connectedCallback();
    this.computed('total', ['price', 'qty'], () => {
      return (this.state.price as number) * (this.state.qty as number);
    });
  }
}
if (!customElements.get("computed-store")) {
  customElements.define("computed-store", ComputedStore);
}

describe("CPXStore: Computed State", () => {

  it("should return the computed value", () => {
    const store = document.createElement("computed-store") as ComputedStore;
    document.body.appendChild(store);

    expect(store.state.total).to.equal(20);

    store.remove();
  });

  it("should recompute when a dependency changes", () => {
    const store = document.createElement("computed-store") as ComputedStore;
    document.body.appendChild(store);

    store.state.price = 5;
    expect(store.state.total).to.equal(10);

    store.state.qty = 4;
    expect(store.state.total).to.equal(20);

    store.remove();
  });

  it("should cache and not recompute when non-dependency changes", () => {
    let callCount = 0;
    const store = document.createElement("computed-store") as ComputedStore;
    document.body.appendChild(store);
    store.computed('derived', ['price'], () => {
      callCount++;
      return (store.state.price as number) * 10;
    });

    expect(store.state.derived).to.equal(100);
    expect(callCount).to.equal(1);

    // access again without any change — should use cache
    expect(store.state.derived).to.equal(100);
    expect(callCount).to.equal(1);

    // change non-dependency — should still use cache
    store.state.qty = 99;
    expect(store.state.derived).to.equal(100);
    expect(callCount).to.equal(1);

    // change dependency — should recompute
    store.state.price = 3;
    expect(store.state.derived).to.equal(30);
    expect(callCount).to.equal(2);

    store.remove();
  });

  it("should silently ignore writes to computed properties", () => {
    const store = document.createElement("computed-store") as ComputedStore;
    document.body.appendChild(store);

    store.state.total = 999;
    expect(store.state.total).to.equal(20);

    store.remove();
  });

  it("should not include computed values in history", () => {
    const store = document.createElement("computed-store") as ComputedStore;
    document.body.appendChild(store);

    store.state.price = 5;
    // history should contain a delta for 'price', not 'total'
    const lastDelta = store._history[store._history.length - 1];
    expect(lastDelta.prop).to.equal('price');

    store.remove();
  });

  it("should recompute correctly after undo", () => {
    const store = document.createElement("computed-store") as ComputedStore;
    document.body.appendChild(store);

    expect(store.state.total).to.equal(20); // 10 * 2
    store.state.price = 5;
    expect(store.state.total).to.equal(10); // 5 * 2

    store.undo();
    expect(store.state.total).to.equal(20); // 10 * 2

    store.remove();
  });
});

// --- Async Dispatch ---

describe("CPXStore: Async Dispatch", () => {

  it("should apply state changes from an async action", async () => {
    const store = new TestStore();
    store.connectedCallback();

    await store.dispatch(async (state) => {
      state.count = 42;
    });

    expect(store.state.count).to.equal(42);
  });

  it("should dispatch a dispatch-error event and reject on failure", async () => {
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
    const store = new TestStore();
    store.connectedCallback();

    await store.dispatch(async (state) => {
      state.count = 10;
      state.count = 20;
    });

    expect(store.state.count).to.equal(20);
    store.undo();
    expect(store.state.count).to.equal(10);
    store.undo();
    expect(store.state.count).to.equal(0);
  });

  it("should fire middleware for changes inside dispatch", async () => {
    let middlewareFired = false;
    const store = document.createElement("test-store") as TestStore;
    document.body.appendChild(store);
    // @ts-ignore: Accessing internal middleware for testing
    store._middleware = [(prop: string | symbol, val: unknown) => {
      if (prop === 'count' && val === 7) middlewareFired = true;
    }];

    await store.dispatch(async (state) => {
      state.count = 7;
    });

    expect(middlewareFired).to.be.true;

    store.remove();
  });
});

describe("CPXStore: sync() method", () => {

  afterEach(() => localStorage.clear());

  it("should apply state and call onStorageChanged", () => {
    const store = document.createElement("callback-test-store") as CallbackTestStore;
    document.body.appendChild(store);

    store.state.count = 10;

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

    store.state.count = 5;
    expect(JSON.parse(localStorage.getItem('sync-test')!).count).to.equal(5);

    store.sync({ count: 200, theme: 'dark' });

    expect(store.state.count).to.equal(200);
    expect(JSON.parse(localStorage.getItem('sync-test')!).count).to.equal(5);

    store.remove();
  });

  it("should dispatch change events", () => {
    const store = document.createElement("persist-test-store") as PersistTestStore;
    document.body.appendChild(store);

    const changes: string[] = [];
    store.addEventListener("change", (e: any) => {
      changes.push(e.detail.prop);
    });

    store.sync({ count: 42, theme: 'sunset' });

    expect(changes).to.include('count');
    expect(changes).to.include('theme');

    store.remove();
  });
});