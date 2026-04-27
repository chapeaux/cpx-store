import { assertEquals, assertThrows } from "@std/assert";
import { CPXStoreCore } from "../src/cpx-store-core.ts";
import { historyPlugin } from "../src/plugins/history.ts";
import { middlewarePlugin } from "../src/plugins/middleware.ts";

Deno.test("CPXStoreCore: read and write state", () => {
  const store = new CPXStoreCore({ count: 0, name: "hello" });

  assertEquals(store.state.count, 0);
  assertEquals(store.state.name, "hello");

  store.state.count = 10;
  assertEquals(store.state.count, 10);
});

Deno.test("CPXStoreCore: computed with auto-tracking", () => {
  const store = new CPXStoreCore({ price: 10, qty: 2 });
  store.computed("total", () => {
    return (store.state.price as number) * (store.state.qty as number);
  });

  assertEquals(store.state.total, 20);

  store.state.price = 5;
  assertEquals(store.state.total, 10);

  store.state.qty = 4;
  assertEquals(store.state.total, 20);
});

Deno.test("CPXStoreCore: computed caches non-dependency changes", () => {
  let callCount = 0;
  const store = new CPXStoreCore({ price: 10, qty: 2, unrelated: "x" });
  store.computed("derived", () => {
    callCount++;
    return (store.state.price as number) * 10;
  });

  assertEquals(store.state.derived, 100);
  assertEquals(callCount, 1);

  store.state.derived; // cached
  assertEquals(callCount, 1);

  store.state.qty = 99; // non-dependency
  store.state.derived;
  assertEquals(callCount, 1);

  store.state.price = 3; // dependency
  assertEquals(store.state.derived, 30);
  assertEquals(callCount, 2);
});

Deno.test("CPXStoreCore: transitive computed dependencies", () => {
  const store = new CPXStoreCore({ base: 2 });
  store.computed("doubled", () => (store.state.base as number) * 2);
  store.computed("quadrupled", () => (store.state.doubled as number) * 2);

  assertEquals(store.state.doubled, 4);
  assertEquals(store.state.quadrupled, 8);

  store.state.base = 5;
  assertEquals(store.state.quadrupled, 20);
});

Deno.test("CPXStoreCore: batch coalesces changes", () => {
  const store = new CPXStoreCore({ a: 0, b: 0 });
  let flushCount = 0;
  store.onChange(() => { flushCount++; });

  store.batch(() => {
    store.state.a = 1;
    store.state.b = 2;
  });

  assertEquals(flushCount, 1);
  assertEquals(store.state.a, 1);
  assertEquals(store.state.b, 2);
});

Deno.test("CPXStoreCore: transaction rolls back on error", () => {
  const store = new CPXStoreCore({ balance: 100 });
  let flushCount = 0;
  store.onChange(() => { flushCount++; });

  assertThrows(() => {
    store.transaction(() => {
      store.state.balance = 0;
      throw new Error("rollback");
    });
  });

  assertEquals(store.state.balance, 100);
  assertEquals(flushCount, 0);
});

Deno.test("CPXStoreCore: undo/redo with history plugin", () => {
  const store = new CPXStoreCore({ count: 0 }, historyPlugin());

  store.state.count = 1;
  store.state.count = 2;
  assertEquals(store.state.count, 2);

  store.undo();
  assertEquals(store.state.count, 1);

  store.redo();
  assertEquals(store.state.count, 2);
});

Deno.test("CPXStoreCore: middleware plugin runs on mutation", () => {
  const log: string[] = [];
  const store = new CPXStoreCore(
    { count: 0 },
    middlewarePlugin([(prop, val) => { log.push(`${prop}=${val}`); }])
  );

  store.state.count = 5;
  assertEquals(log, ["count=5"]);
});

Deno.test("CPXStoreCore: onChange handler receives batched changes", () => {
  const store = new CPXStoreCore({ a: 0, b: 0 });
  let received: Record<string, any> | null = null;

  store.onChange((changes) => {
    received = Object.fromEntries(changes);
  });

  store.batch(() => {
    store.state.a = 1;
    store.state.b = 2;
  });

  assertEquals(received!.a, { old: 0, val: 1 });
  assertEquals(received!.b, { old: 0, val: 2 });
});

Deno.test("CPXStoreCore: onChange unsubscribe works", () => {
  const store = new CPXStoreCore({ count: 0 });
  let called = false;
  const unsub = store.onChange(() => { called = true; });
  unsub();

  store.batch(() => { store.state.count = 1; });
  assertEquals(called, false);
});

Deno.test("CPXStoreCore: sync applies remote state", () => {
  const store = new CPXStoreCore({ count: 0, theme: "light" });

  store.sync({ count: 42, theme: "dark" });

  assertEquals(store.state.count, 42);
  assertEquals(store.state.theme, "dark");
});

Deno.test("CPXStoreCore: onSyncReceived callback", () => {
  let received: { newState: any; oldState: any } | null = null;

  class TestStore extends CPXStoreCore {
    override onSyncReceived(newState: Record<string, unknown>, oldState: Record<string, unknown>) {
      received = { newState, oldState };
    }
  }

  const store = new TestStore({ count: 0 });
  store.state.count = 10;
  store.sync({ count: 50 });

  assertEquals(received!.newState.count, 50);
  assertEquals(received!.oldState.count, 10);
});

Deno.test("CPXStoreCore: toJSON serializes state", () => {
  const store = new CPXStoreCore({ count: 5, name: "test" });
  const json = store.toJSON();

  assertEquals(json, { count: 5, name: "test" });
  assertEquals(JSON.stringify(store.toJSON()), '{"count":5,"name":"test"}');
});

Deno.test("CPXStoreCore: nested state read and write", () => {
  const store = new CPXStoreCore({
    editor: { file1: { content: "hello" } }
  });

  assertEquals((store.state.editor as any).file1.content, "hello");

  (store.state.editor as any).file1.content = "updated";
  assertEquals((store.state.editor as any).file1.content, "updated");
});

Deno.test("CPXStoreCore: dispatch auto-batches", async () => {
  const store = new CPXStoreCore({ count: 0 });
  let flushCount = 0;
  store.onChange(() => { flushCount++; });

  await store.dispatch(async (state) => {
    state.count = 1;
    state.count = 2;
    state.count = 3;
  });

  assertEquals(store.state.count, 3);
  assertEquals(flushCount, 1);
});
