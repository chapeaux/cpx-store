import { expect } from "@esm-bundle/chai";
import { CPXStore } from "../src/cpx-store.ts";
import { collabPlugin } from "../src/plugins/collab.ts";
import { BroadcastChannelTransport } from "../src/transports/broadcast-channel.ts";
import type { SyncTransport, StateOperation } from "../src/types.ts";

const nextTick = () => new Promise<void>(r => queueMicrotask(r));
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// --- Mock Transport ---

class MockTransport implements SyncTransport {
  sent: StateOperation[] = [];
  private _handler: ((op: StateOperation) => void) | null = null;
  connected = false;

  send(op: StateOperation): void {
    this.sent.push(op);
  }

  onReceive(handler: (op: StateOperation) => void): void {
    this._handler = handler;
  }

  connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  disconnect(): void {
    this.connected = false;
  }

  /** Simulate receiving a remote operation. */
  simulateReceive(op: StateOperation): void {
    if (this._handler) this._handler(op);
  }
}

// --- BroadcastChannelTransport ---

describe("BroadcastChannelTransport", () => {

  it("two transports on same channel can send and receive", async () => {
    const channelName = "test-bc-" + Math.random().toString(36).slice(2);
    const transport1 = new BroadcastChannelTransport(channelName);
    const transport2 = new BroadcastChannelTransport(channelName);

    let received: StateOperation | null = null;
    transport2.onReceive((op) => { received = op; });

    await transport1.connect();
    await transport2.connect();

    const op: StateOperation = {
      id: "op-1",
      origin: "client-a",
      timestamp: Date.now(),
      prop: "count",
      type: "set",
      value: 42,
    };

    transport1.send(op);

    // BroadcastChannel delivery is async; wait briefly
    await delay(50);

    expect(received).to.not.be.null;
    expect(received!.id).to.equal("op-1");
    expect(received!.prop).to.equal("count");
    expect(received!.value).to.equal(42);

    transport1.disconnect();
    transport2.disconnect();
  });

  it("should not receive after disconnect", async () => {
    const channelName = "test-bc-disc-" + Math.random().toString(36).slice(2);
    const transport1 = new BroadcastChannelTransport(channelName);
    const transport2 = new BroadcastChannelTransport(channelName);

    let receiveCount = 0;
    transport2.onReceive(() => { receiveCount++; });

    await transport1.connect();
    await transport2.connect();

    transport2.disconnect();

    const op: StateOperation = {
      id: "op-2",
      origin: "client-a",
      timestamp: Date.now(),
      prop: "count",
      type: "set",
      value: 99,
    };

    transport1.send(op);
    await delay(50);

    expect(receiveCount).to.equal(0);

    transport1.disconnect();
  });
});

// --- Collab Plugin with MockTransport ---

describe("Collab Plugin", () => {

  it("local mutation creates operation and sends via transport", async () => {
    const transport = new MockTransport();
    const tag = "collab-send-" + Math.random().toString(36).slice(2);

    class CollabStore extends CPXStore {
      constructor() {
        super({ count: 0 }, collabPlugin({ transport, clientId: "local-1" }));
      }
    }
    customElements.define(tag, CollabStore);
    const store = document.createElement(tag) as CollabStore;
    document.body.appendChild(store);

    // Wait for transport.connect() to resolve
    await nextTick();

    store.state.count = 10;

    expect(transport.sent.length).to.equal(1);
    expect(transport.sent[0].prop).to.equal("count");
    expect(transport.sent[0].value).to.equal(10);
    expect(transport.sent[0].origin).to.equal("local-1");
    expect(transport.sent[0].type).to.equal("set");
    expect(transport.sent[0].id).to.be.a("string");

    store.remove();
  });

  it("received operation applies to store state", async () => {
    const transport = new MockTransport();
    const tag = "collab-recv-" + Math.random().toString(36).slice(2);

    class CollabStore extends CPXStore {
      constructor() {
        super({ count: 0 }, collabPlugin({ transport, clientId: "local-2" }));
      }
    }
    customElements.define(tag, CollabStore);
    const store = document.createElement(tag) as CollabStore;
    document.body.appendChild(store);
    await nextTick();

    transport.simulateReceive({
      id: "remote-op-1",
      origin: "remote-peer",
      timestamp: Date.now(),
      prop: "count",
      type: "set",
      value: 77,
    });

    expect(store.state.count).to.equal(77);

    store.remove();
  });

  it("no echo: local changes do not bounce back", async () => {
    const transport = new MockTransport();
    const tag = "collab-echo-" + Math.random().toString(36).slice(2);

    class CollabStore extends CPXStore {
      constructor() {
        super({ count: 0 }, collabPlugin({ transport, clientId: "echo-client" }));
      }
    }
    customElements.define(tag, CollabStore);
    const store = document.createElement(tag) as CollabStore;
    document.body.appendChild(store);
    await nextTick();

    store.state.count = 5;

    // Simulate receiving our own operation back (echo)
    transport.simulateReceive({
      id: "echo-op",
      origin: "echo-client", // same clientId
      timestamp: Date.now(),
      prop: "count",
      type: "set",
      value: 999,
    });

    // Should be unchanged — the echo was ignored
    expect(store.state.count).to.equal(5);

    store.remove();
  });

  it("operation log grows on local mutations", async () => {
    const transport = new MockTransport();
    const tag = "collab-log-" + Math.random().toString(36).slice(2);

    class CollabStore extends CPXStore {
      constructor() {
        super({ count: 0 }, collabPlugin({ transport, clientId: "log-client" }));
      }
    }
    customElements.define(tag, CollabStore);
    const store = document.createElement(tag) as CollabStore;
    document.body.appendChild(store);
    await nextTick();

    store.state.count = 1;
    store.state.count = 2;
    store.state.count = 3;

    const log = (store as any).getOperationLog();
    expect(log.length).to.equal(3);
    expect(log[0].value).to.equal(1);
    expect(log[1].value).to.equal(2);
    expect(log[2].value).to.equal(3);

    store.remove();
  });

  it("operation log includes received remote operations", async () => {
    const transport = new MockTransport();
    const tag = "collab-logremote-" + Math.random().toString(36).slice(2);

    class CollabStore extends CPXStore {
      constructor() {
        super({ count: 0 }, collabPlugin({ transport, clientId: "log-client-2" }));
      }
    }
    customElements.define(tag, CollabStore);
    const store = document.createElement(tag) as CollabStore;
    document.body.appendChild(store);
    await nextTick();

    store.state.count = 1;

    transport.simulateReceive({
      id: "remote-1",
      origin: "peer",
      timestamp: Date.now(),
      prop: "count",
      type: "set",
      value: 50,
    });

    const log = (store as any).getOperationLog();
    // 1 local + 1 remote
    expect(log.length).to.equal(2);

    store.remove();
  });

  it("cleanup on destroy", async () => {
    const transport = new MockTransport();
    const tag = "collab-destroy-" + Math.random().toString(36).slice(2);

    class CollabStore extends CPXStore {
      constructor() {
        super({ count: 0 }, collabPlugin({ transport, clientId: "destroy-client" }));
      }
    }
    customElements.define(tag, CollabStore);
    const store = document.createElement(tag) as CollabStore;
    document.body.appendChild(store);
    await nextTick();

    expect(transport.connected).to.be.true;

    store.remove();

    expect(transport.connected).to.be.false;
  });

  it("default conflict resolution: last-writer-wins", async () => {
    const transport = new MockTransport();
    const tag = "collab-lww-" + Math.random().toString(36).slice(2);

    class CollabStore extends CPXStore {
      constructor() {
        super({ count: 0 }, collabPlugin({ transport, clientId: "lww-client" }));
      }
    }
    customElements.define(tag, CollabStore);
    const store = document.createElement(tag) as CollabStore;
    document.body.appendChild(store);
    await nextTick();

    // Local mutation at a known time
    store.state.count = 10;

    const localOp = transport.sent[0];

    // Remote operation with a LATER timestamp wins
    transport.simulateReceive({
      id: "remote-lww",
      origin: "peer",
      timestamp: localOp.timestamp + 1000,
      prop: "count",
      type: "set",
      value: 99,
    });

    expect(store.state.count).to.equal(99);

    // Remote operation with an EARLIER timestamp loses
    store.state.count = 50;

    transport.simulateReceive({
      id: "remote-old",
      origin: "peer",
      timestamp: 0, // very old
      prop: "count",
      type: "set",
      value: 1,
    });

    // Local value should remain since remote is older
    expect(store.state.count).to.equal(50);

    store.remove();
  });

  it("custom conflict resolver is used", async () => {
    const transport = new MockTransport();
    const tag = "collab-custom-" + Math.random().toString(36).slice(2);

    // Custom resolver: always pick the remote op
    const alwaysRemote = {
      resolve(_local: StateOperation, remote: StateOperation) {
        return remote;
      }
    };

    class CollabStore extends CPXStore {
      constructor() {
        super({ count: 0 }, collabPlugin({
          transport,
          clientId: "custom-client",
          resolver: alwaysRemote,
        }));
      }
    }
    customElements.define(tag, CollabStore);
    const store = document.createElement(tag) as CollabStore;
    document.body.appendChild(store);
    await nextTick();

    store.state.count = 10;

    // Even with an old timestamp, the custom resolver always picks remote
    transport.simulateReceive({
      id: "remote-custom",
      origin: "peer",
      timestamp: 0,
      prop: "count",
      type: "set",
      value: 1,
    });

    expect(store.state.count).to.equal(1);

    store.remove();
  });

  it("store.disconnect() disconnects transport", async () => {
    const transport = new MockTransport();
    const tag = "collab-disconn-" + Math.random().toString(36).slice(2);

    class CollabStore extends CPXStore {
      constructor() {
        super({ count: 0 }, collabPlugin({ transport, clientId: "disc-client" }));
      }
    }
    customElements.define(tag, CollabStore);
    const store = document.createElement(tag) as CollabStore;
    document.body.appendChild(store);
    await nextTick();

    expect(transport.connected).to.be.true;

    (store as any).disconnect();

    expect(transport.connected).to.be.false;

    store.remove();
  });
});

// --- WebSocket Transport ---
// NOTE: WebSocketTransport tests require a real WebSocket server.
// These are documented here as placeholders; run them with a local WS server.

// describe("WebSocketTransport", () => {
//   it("should connect and send operations", async () => {
//     // Requires: ws://localhost:8080
//   });
//
//   it("should queue operations during disconnect and flush on reconnect", async () => {
//     // Requires: ws://localhost:8080
//   });
// });
