import { expect } from "@esm-bundle/chai";
import { CPXStore } from "../src/cpx-store.ts";
import { historyPlugin } from "../src/plugins/history.ts";
import { persistencePlugin } from "../src/plugins/persistence.ts";

const nextTick = () => new Promise<void>(r => queueMicrotask(r));

describe("Nested State: Deep Read", () => {

  it("should read deeply nested properties", () => {
    class DeepReadStore extends CPXStore {
      constructor() {
        super({
          editor: { file1: { content: 'hello', selections: [1, 2] } }
        });
      }
    }
    const tag = "deep-read-" + Math.random().toString(36).slice(2);
    customElements.define(tag, DeepReadStore);
    const store = document.createElement(tag) as DeepReadStore;
    document.body.appendChild(store);

    expect((store.state.editor as any).file1.content).to.equal('hello');
    expect((store.state.editor as any).file1.selections).to.deep.equal([1, 2]);

    store.remove();
  });

  it("should return undefined for non-existent nested paths", () => {
    class DeepReadStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'hello' } } });
      }
    }
    const tag = "deep-read-undef-" + Math.random().toString(36).slice(2);
    customElements.define(tag, DeepReadStore);
    const store = document.createElement(tag) as DeepReadStore;
    document.body.appendChild(store);

    expect((store.state.editor as any).file1.missing).to.be.undefined;

    store.remove();
  });
});

describe("Nested State: Deep Write", () => {

  it("should write deeply nested properties and trigger change event with dot-path key", async () => {
    class DeepWriteStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'hello' } } });
      }
    }
    const tag = "deep-write-" + Math.random().toString(36).slice(2);
    customElements.define(tag, DeepWriteStore);
    const store = document.createElement(tag) as DeepWriteStore;
    document.body.appendChild(store);

    let eventDetail: any = null;
    store.addEventListener("change", (e: any) => {
      eventDetail = e.detail;
    });

    (store.state.editor as any).file1.content = 'world';

    expect((store.state.editor as any).file1.content).to.equal('world');

    await nextTick();
    expect(eventDetail).to.exist;
    expect(eventDetail.changes['editor.file1.content']).to.exist;
    expect(eventDetail.changes['editor.file1.content'].old).to.equal('hello');
    expect(eventDetail.changes['editor.file1.content'].val).to.equal('world');

    store.remove();
  });

  it("should not fire event when nested value is unchanged", async () => {
    class DeepWriteStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'hello' } } });
      }
    }
    const tag = "deep-noop-" + Math.random().toString(36).slice(2);
    customElements.define(tag, DeepWriteStore);
    const store = document.createElement(tag) as DeepWriteStore;
    document.body.appendChild(store);

    let eventFired = false;
    store.addEventListener("change", () => { eventFired = true; });

    (store.state.editor as any).file1.content = 'hello';

    await nextTick();
    expect(eventFired).to.be.false;

    store.remove();
  });
});

describe("Nested State: Sub-object Replacement", () => {

  it("should replace an entire sub-object and access new nested props", () => {
    class SubReplaceStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'old' } } });
      }
    }
    const tag = "sub-replace-" + Math.random().toString(36).slice(2);
    customElements.define(tag, SubReplaceStore);
    const store = document.createElement(tag) as SubReplaceStore;
    document.body.appendChild(store);

    store.state.editor = { file1: { content: 'new' }, file2: { content: 'added' } };

    expect((store.state.editor as any).file1.content).to.equal('new');
    expect((store.state.editor as any).file2.content).to.equal('added');

    store.remove();
  });

  it("should invalidate old nested proxies after sub-object replacement", () => {
    class SubReplaceStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'old' } } });
      }
    }
    const tag = "sub-inval-" + Math.random().toString(36).slice(2);
    customElements.define(tag, SubReplaceStore);
    const store = document.createElement(tag) as SubReplaceStore;
    document.body.appendChild(store);

    const oldEditor = store.state.editor;

    store.state.editor = { file1: { content: 'replaced' } };

    const newEditor = store.state.editor;
    expect(newEditor).to.not.equal(oldEditor);
    expect((newEditor as any).file1.content).to.equal('replaced');

    store.remove();
  });
});

describe("Nested State: History (Undo/Redo)", () => {

  it("should undo nested property changes", () => {
    class NestedHistoryStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'original' } } }, historyPlugin());
      }
    }
    const tag = "nested-hist-" + Math.random().toString(36).slice(2);
    customElements.define(tag, NestedHistoryStore);
    const store = document.createElement(tag) as NestedHistoryStore;
    document.body.appendChild(store);

    (store.state.editor as any).file1.content = 'modified';
    expect((store.state.editor as any).file1.content).to.equal('modified');

    store.undo();
    expect((store.state.editor as any).file1.content).to.equal('original');

    store.redo();
    expect((store.state.editor as any).file1.content).to.equal('modified');

    store.remove();
  });

  it("should undo multiple nested changes in reverse order", () => {
    class NestedHistoryStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'v1' } } }, historyPlugin());
      }
    }
    const tag = "nested-hist-multi-" + Math.random().toString(36).slice(2);
    customElements.define(tag, NestedHistoryStore);
    const store = document.createElement(tag) as NestedHistoryStore;
    document.body.appendChild(store);

    (store.state.editor as any).file1.content = 'v2';
    (store.state.editor as any).file1.content = 'v3';

    store.undo();
    expect((store.state.editor as any).file1.content).to.equal('v2');
    store.undo();
    expect((store.state.editor as any).file1.content).to.equal('v1');

    store.remove();
  });
});

describe("Nested State: Persistence", () => {

  afterEach(() => localStorage.clear());

  it("should serialize _state correctly with nested objects via JSON.stringify", () => {
    class NestedPersistStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'hello' } }, count: 0 }, persistencePlugin());
      }
    }
    const tag = "nested-persist-" + Math.random().toString(36).slice(2);
    customElements.define(tag, NestedPersistStore);
    const store = document.createElement(tag) as NestedPersistStore;
    store.setAttribute('persist', 'nested-persist-test');
    document.body.appendChild(store);

    const serialized = JSON.stringify(store._state);
    const parsed = JSON.parse(serialized);
    expect(parsed.editor.file1.content).to.equal('hello');
    expect(parsed.count).to.equal(0);

    store.remove();
  });

  it("should persist nested state changes to localStorage", async () => {
    class NestedPersistStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'hello' } } }, persistencePlugin());
      }
    }
    const tag = "nested-persist-write-" + Math.random().toString(36).slice(2);
    customElements.define(tag, NestedPersistStore);
    const store = document.createElement(tag) as NestedPersistStore;
    store.setAttribute('persist', 'nested-persist-write');
    document.body.appendChild(store);

    (store.state.editor as any).file1.content = 'updated';
    await nextTick();

    const saved = JSON.parse(localStorage.getItem('nested-persist-write')!);
    expect(saved.editor.file1.content).to.equal('updated');

    store.remove();
  });
});

describe("Nested State: Computed", () => {

  it("should auto-track nested property reads in computed", () => {
    class NestedComputedStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'hello' } } });
      }
      connectedCallback() {
        super.connectedCallback();
        this.computed('contentLength', () => {
          return ((this.state.editor as any).file1.content as string).length;
        });
      }
    }
    const tag = "nested-computed-" + Math.random().toString(36).slice(2);
    customElements.define(tag, NestedComputedStore);
    const store = document.createElement(tag) as NestedComputedStore;
    document.body.appendChild(store);

    expect(store.state.contentLength).to.equal(5);

    (store.state.editor as any).file1.content = 'hi';
    expect(store.state.contentLength).to.equal(2);

    store.remove();
  });

  it("should not recompute when unrelated nested property changes", () => {
    let callCount = 0;
    class NestedComputedStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'hello' }, file2: { content: 'world' } } });
      }
      connectedCallback() {
        super.connectedCallback();
        this.computed('file1Len', () => {
          callCount++;
          return ((this.state.editor as any).file1.content as string).length;
        });
      }
    }
    const tag = "nested-comp-cache-" + Math.random().toString(36).slice(2);
    customElements.define(tag, NestedComputedStore);
    const store = document.createElement(tag) as NestedComputedStore;
    document.body.appendChild(store);

    expect(store.state.file1Len).to.equal(5);
    expect(callCount).to.equal(1);

    (store.state.editor as any).file2.content = 'changed';
    expect(store.state.file1Len).to.equal(5);
    expect(callCount).to.equal(1);

    (store.state.editor as any).file1.content = 'hi';
    expect(store.state.file1Len).to.equal(2);
    expect(callCount).to.equal(2);

    store.remove();
  });
});

describe("Nested State: Batch", () => {

  it("should produce single event for batched nested mutations", () => {
    class NestedBatchStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'a' }, file2: { content: 'b' } } });
      }
    }
    const tag = "nested-batch-" + Math.random().toString(36).slice(2);
    customElements.define(tag, NestedBatchStore);
    const store = document.createElement(tag) as NestedBatchStore;
    document.body.appendChild(store);

    let eventCount = 0;
    let eventDetail: any = null;
    store.addEventListener("change", (e: any) => {
      eventCount++;
      eventDetail = e.detail;
    });

    store.batch(() => {
      (store.state.editor as any).file1.content = 'x';
      (store.state.editor as any).file2.content = 'y';
    });

    expect(eventCount).to.equal(1);
    expect(eventDetail.changes['editor.file1.content'].val).to.equal('x');
    expect(eventDetail.changes['editor.file2.content'].val).to.equal('y');

    store.remove();
  });

  it("should coalesce multiple changes to the same nested path", () => {
    class NestedBatchStore extends CPXStore {
      constructor() {
        super({ editor: { file1: { content: 'start' } } });
      }
    }
    const tag = "nested-batch-coalesce-" + Math.random().toString(36).slice(2);
    customElements.define(tag, NestedBatchStore);
    const store = document.createElement(tag) as NestedBatchStore;
    document.body.appendChild(store);

    let eventDetail: any = null;
    store.addEventListener("change", (e: any) => { eventDetail = e.detail; });

    store.batch(() => {
      (store.state.editor as any).file1.content = 'mid';
      (store.state.editor as any).file1.content = 'end';
    });

    expect(eventDetail.changes['editor.file1.content'].old).to.equal('start');
    expect(eventDetail.changes['editor.file1.content'].val).to.equal('end');

    store.remove();
  });
});
