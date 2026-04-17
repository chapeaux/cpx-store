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

    store.state.count = 1; // Snapshot 1
    store.state.count = 2; // Snapshot 2
    expect(store.state.count).to.equal(2);

    store.undo();
    expect(store.state.count).to.equal(1);

    store.redo();
    expect(store.state.count).to.equal(2);
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