import { expect } from "@esm-bundle/chai";
import { CPXStore } from "../src/cpx-store.ts";
import { historyPlugin } from "../src/plugins/history.ts";

const nextTick = () => new Promise<void>(r => queueMicrotask(r));

// --- String Patch Tests ---

describe("History: String patch strategy", () => {

  it("should undo a middle-of-string edit", () => {
    const tag = "str-patch-mid-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super({ text: 'hello world' }, historyPlugin({ defaultStrategy: 'patch' }));
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    store.state.text = 'hello beautiful world';
    expect(store.state.text).to.equal('hello beautiful world');

    store.undo();
    expect(store.state.text).to.equal('hello world');

    store.remove();
  });

  it("should handle multiple edits with undo/redo chain", () => {
    const tag = "str-patch-chain-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super({ text: 'aaa' }, historyPlugin({ defaultStrategy: 'patch' }));
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    store.state.text = 'aaa bbb';
    store.state.text = 'aaa bbb ccc';
    store.state.text = 'aaa bbb ccc ddd';

    store.undo();
    expect(store.state.text).to.equal('aaa bbb ccc');

    store.undo();
    expect(store.state.text).to.equal('aaa bbb');

    store.redo();
    expect(store.state.text).to.equal('aaa bbb ccc');

    store.redo();
    expect(store.state.text).to.equal('aaa bbb ccc ddd');

    // redo at end does nothing
    store.redo();
    expect(store.state.text).to.equal('aaa bbb ccc ddd');

    store.remove();
  });

  it("should create full snapshots at checkpoint intervals", () => {
    const tag = "str-patch-ckpt-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super({ text: 'start' }, historyPlugin({
          defaultStrategy: 'patch',
          checkpointInterval: 3,
        }));
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    store.state.text = 'start a';
    store.state.text = 'start a b';
    store.state.text = 'start a b c'; // 3rd op triggers checkpoint

    // undo all the way
    store.undo();
    expect(store.state.text).to.equal('start a b');
    store.undo();
    expect(store.state.text).to.equal('start a');
    store.undo();
    expect(store.state.text).to.equal('start');

    // redo all the way
    store.redo();
    store.redo();
    store.redo();
    expect(store.state.text).to.equal('start a b c');

    store.remove();
  });
});

// --- Object Patch Tests ---

describe("History: Object patch strategy", () => {

  it("should undo a property change on an object", () => {
    const tag = "obj-patch-prop-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super(
          { config: { color: 'red', size: 10 } },
          historyPlugin({ defaultStrategy: 'patch' })
        );
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    store.state.config = { color: 'blue', size: 10 };
    expect((store.state.config as any).color).to.equal('blue');

    store.undo();
    expect((store.state.config as any).color).to.equal('red');
    expect((store.state.config as any).size).to.equal(10);

    store.remove();
  });

  it("should undo add and remove of properties", () => {
    const tag = "obj-patch-addrem-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super(
          { data: { a: 1, b: 2 } },
          historyPlugin({ defaultStrategy: 'patch' })
        );
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    // Add property c, remove property a
    store.state.data = { b: 2, c: 3 };
    expect((store.state.data as any).c).to.equal(3);
    expect((store.state.data as any).a).to.be.undefined;

    store.undo();
    const restored = store.state.data as any;
    expect(restored.a).to.equal(1);
    expect(restored.b).to.equal(2);
    expect(restored.c).to.be.undefined;

    // Redo brings back the change
    store.redo();
    const redone = store.state.data as any;
    expect(redone.a).to.be.undefined;
    expect(redone.b).to.equal(2);
    expect(redone.c).to.equal(3);

    store.remove();
  });

  it("should handle nested object changes (one level deep)", () => {
    const tag = "obj-patch-nested-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super(
          { settings: { ui: { theme: 'light', fontSize: 14 }, lang: 'en' } },
          historyPlugin({ defaultStrategy: 'patch' })
        );
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    store.state.settings = { ui: { theme: 'dark', fontSize: 14 }, lang: 'en' };
    expect((store.state.settings as any).ui.theme).to.equal('dark');

    store.undo();
    expect((store.state.settings as any).ui.theme).to.equal('light');
    expect((store.state.settings as any).lang).to.equal('en');

    store.remove();
  });

  it("should create checkpoints for object patches", () => {
    const tag = "obj-patch-ckpt-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super(
          { obj: { count: 0 } },
          historyPlugin({ defaultStrategy: 'patch', checkpointInterval: 2 })
        );
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    store.state.obj = { count: 1 };
    store.state.obj = { count: 2 }; // 2nd op triggers checkpoint

    // undo all the way back
    store.undo();
    expect((store.state.obj as any).count).to.equal(1);
    store.undo();
    expect((store.state.obj as any).count).to.equal(0);

    // redo all the way forward
    store.redo();
    store.redo();
    expect((store.state.obj as any).count).to.equal(2);

    store.remove();
  });

  it("should handle multiple object edits with undo/redo", () => {
    const tag = "obj-patch-multi-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super(
          { item: { name: 'A', value: 1 } },
          historyPlugin({ defaultStrategy: 'patch' })
        );
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    store.state.item = { name: 'B', value: 1 };
    store.state.item = { name: 'B', value: 2 };
    store.state.item = { name: 'C', value: 3 };

    store.undo();
    expect((store.state.item as any).name).to.equal('B');
    expect((store.state.item as any).value).to.equal(2);

    store.undo();
    expect((store.state.item as any).name).to.equal('B');
    expect((store.state.item as any).value).to.equal(1);

    store.undo();
    expect((store.state.item as any).name).to.equal('A');
    expect((store.state.item as any).value).to.equal(1);

    store.redo();
    store.redo();
    store.redo();
    expect((store.state.item as any).name).to.equal('C');
    expect((store.state.item as any).value).to.equal(3);

    store.remove();
  });
});

// --- Strategy 'none' and runtime changes ---

describe("History: Strategy 'none' and runtime changes", () => {

  it("should not record changes for strategy 'none'", () => {
    const tag = "strat-none-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super(
          { cursor: 0, content: 'hello' },
          historyPlugin({ strategies: { cursor: 'none' } })
        );
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    store.state.cursor = 5;
    store.state.cursor = 10;
    store.state.content = 'world';

    store.undo();
    expect(store.state.content).to.equal('hello');
    expect(store.state.cursor).to.equal(10); // cursor not in history

    // further undo does nothing
    store.undo();
    expect(store.state.content).to.equal('hello');

    store.remove();
  });

  it("should allow changing strategy at runtime with historyStrategy()", () => {
    const tag = "strat-runtime-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super(
          { text: 'start' },
          historyPlugin({ defaultStrategy: 'snapshot' })
        );
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    // First change uses snapshot
    store.state.text = 'snapshot change';

    // Switch to patch strategy
    (store as any).historyStrategy('text', 'patch');

    store.state.text = 'patch change';

    // Undo the patch change
    store.undo();
    expect(store.state.text).to.equal('snapshot change');

    // Undo the snapshot change
    store.undo();
    expect(store.state.text).to.equal('start');

    // Redo both
    store.redo();
    expect(store.state.text).to.equal('snapshot change');
    store.redo();
    expect(store.state.text).to.equal('patch change');

    store.remove();
  });

  it("should clear all history with clearHistory()", () => {
    const tag = "strat-clear-" + Math.random().toString(36).slice(2);
    class S extends CPXStore {
      constructor() {
        super({ count: 0 }, historyPlugin());
      }
    }
    customElements.define(tag, S);
    const store = document.createElement(tag) as S;
    document.body.appendChild(store);

    store.state.count = 1;
    store.state.count = 2;
    store.state.count = 3;

    (store as any).clearHistory();

    // undo should do nothing after clear
    store.undo();
    expect(store.state.count).to.equal(3);

    // new changes work after clear
    store.state.count = 4;
    store.undo();
    expect(store.state.count).to.equal(3);

    store.remove();
  });
});
