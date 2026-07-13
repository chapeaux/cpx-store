import { expect } from "@esm-bundle/chai";
import { SSETransport } from "../src/transports/sse.ts";
import type { StateOperation } from "../src/types.ts";

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// --- Mock EventSource ---

type EventSourceListener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: EventSourceListener | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Simulate async open
    queueMicrotask(() => {
      if (!this.closed) {
        this.readyState = 1; // OPEN
        this.onopen?.();
      }
    });
  }

  close() {
    this.closed = true;
    this.readyState = 2; // CLOSED
  }

  /** Test helper: push a message event. */
  _pushMessage(data: string) {
    if (this.closed) return;
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  /** Test helper: trigger an error. */
  _triggerError() {
    this.onerror?.();
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// --- Mock fetch ---

let fetchCalls: { url: string; init: RequestInit }[] = [];
let fetchShouldFail = false;

function mockFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  fetchCalls.push({ url: url as string, init: init ?? {} });
  if (fetchShouldFail) {
    return Promise.reject(new Error("fetch failed"));
  }
  return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
}

// Install mocks
const OriginalEventSource = globalThis.EventSource;
const originalFetch = globalThis.fetch;

function installMocks() {
  (globalThis as any).EventSource = MockEventSource;
  (globalThis as any).fetch = mockFetch;
  MockEventSource.reset();
  fetchCalls = [];
  fetchShouldFail = false;
}

function restoreMocks() {
  (globalThis as any).EventSource = OriginalEventSource;
  (globalThis as any).fetch = originalFetch;
}

const sampleOp: StateOperation = {
  id: "op-1",
  origin: "client-a",
  timestamp: 1000,
  prop: "count",
  type: "set",
  value: 42,
};

// --- Tests ---

describe("SSETransport", () => {

  beforeEach(() => installMocks());
  afterEach(() => restoreMocks());

  it("connects via EventSource", async () => {
    const transport = new SSETransport("/api/events");
    await transport.connect();

    expect(MockEventSource.instances.length).to.equal(1);
    expect(MockEventSource.instances[0].url).to.equal("/api/events");

    transport.disconnect();
  });

  it("receives operations from EventSource messages", async () => {
    const transport = new SSETransport("/api/events");
    let received: StateOperation | null = null;
    transport.onReceive((op) => { received = op; });

    await transport.connect();

    const es = MockEventSource.instances[0];
    es._pushMessage(JSON.stringify(sampleOp));

    expect(received).to.not.be.null;
    expect(received!.id).to.equal("op-1");
    expect(received!.prop).to.equal("count");
    expect(received!.value).to.equal(42);

    transport.disconnect();
  });

  it("ignores malformed messages", async () => {
    const transport = new SSETransport("/api/events");
    let receiveCount = 0;
    transport.onReceive(() => { receiveCount++; });

    await transport.connect();

    const es = MockEventSource.instances[0];
    es._pushMessage("not json");

    expect(receiveCount).to.equal(0);

    transport.disconnect();
  });

  it("sends operations via POST when apiUrl is provided", async () => {
    const transport = new SSETransport("/api/events", { apiUrl: "/api/state" });
    await transport.connect();

    transport.send(sampleOp);
    await delay(10);

    expect(fetchCalls.length).to.equal(1);
    expect(fetchCalls[0].url).to.equal("/api/state");
    expect(fetchCalls[0].init.method).to.equal("POST");

    const body = JSON.parse(fetchCalls[0].init.body as string);
    expect(body.prop).to.equal("count");
    expect(body.value).to.equal(42);

    transport.disconnect();
  });

  it("send is a no-op without apiUrl (receive-only mode)", async () => {
    const transport = new SSETransport("/api/events");
    await transport.connect();

    transport.send(sampleOp);
    await delay(10);

    expect(fetchCalls.length).to.equal(0);

    transport.disconnect();
  });

  it("includes custom headers in POST requests", async () => {
    const transport = new SSETransport("/api/events", {
      apiUrl: "/api/state",
      headers: { "Authorization": "Bearer token123" },
    });
    await transport.connect();

    transport.send(sampleOp);
    await delay(10);

    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers["Authorization"]).to.equal("Bearer token123");
    expect(headers["Content-Type"]).to.equal("application/json");

    transport.disconnect();
  });

  it("queues operations sent before connect and flushes after", async () => {
    const transport = new SSETransport("/api/events", { apiUrl: "/api/state" });

    transport.send(sampleOp);
    transport.send({ ...sampleOp, id: "op-2", value: 99 });

    expect(fetchCalls.length).to.equal(0);

    await transport.connect();
    await delay(10);

    expect(fetchCalls.length).to.equal(2);

    transport.disconnect();
  });

  it("closes EventSource on disconnect", async () => {
    const transport = new SSETransport("/api/events");
    await transport.connect();

    const es = MockEventSource.instances[0];
    expect(es.closed).to.be.false;

    transport.disconnect();
    expect(es.closed).to.be.true;
  });

  it("does not receive messages after disconnect", async () => {
    const transport = new SSETransport("/api/events");
    let receiveCount = 0;
    transport.onReceive(() => { receiveCount++; });

    await transport.connect();
    const es = MockEventSource.instances[0];

    transport.disconnect();

    es._pushMessage(JSON.stringify(sampleOp));
    expect(receiveCount).to.equal(0);
  });
});
