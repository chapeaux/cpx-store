# CPX Store

> Reactive state management with a plugin architecture, signal-inspired computed properties, and a headless core that runs anywhere JavaScript runs.

[![License](https://img.shields.io/badge/license-SEE%20LICENSE-blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Web Components](https://img.shields.io/badge/Web%20Components-v1-green)](https://www.webcomponents.org/)

## Features

- **Framework-Agnostic** — Works with vanilla JavaScript, React, Vue, Lit, Svelte, or server-side code
- **Headless Core** — `CPXStoreCore` runs in Node, Deno, Bun, and Cloudflare Workers with no DOM
- **Plugin Architecture** — Opt into middleware, history, persistence, and collaboration — or use none
- **Signal-Inspired Reactivity** — Auto-tracked computed properties with no dependency arrays
- **Microtask-Coalesced Events** — Multiple mutations in one tick produce one event
- **Batching and Transactions** — `batch()` for explicit grouping, `transaction()` for rollback on error
- **Nested State** — Deep object access via recursive Proxies with dot-path change tracking
- **History Strategies** — Per-property undo/redo with snapshot, patch, or none strategies
- **Persistent Storage** — Optional localStorage with cross-tab sync
- **Pluggable Collaboration** — BroadcastChannel and WebSocket transports with conflict resolution
- **Zero Dependencies** — ~1,040 lines of TypeScript total

## Installation

```bash
# Using JSR (recommended)
deno add jsr:@chapeaux/cpx-store

# Using npm
npm install @chapeaux/cpx-store
```

## Quick Start

### Browser — Web Component

```typescript
import { CPXStore } from '@chapeaux/cpx-store';
import { historyPlugin } from '@chapeaux/cpx-store/plugins/history';

class AppStore extends CPXStore {
  constructor() {
    super({ count: 0 }, historyPlugin());
  }
}

customElements.define('app-store', AppStore);
```

```html
<app-store id="store"></app-store>

<script>
  const store = document.querySelector('#store');

  store.addEventListener('change', (e) => {
    const { changes } = e.detail;
    if (changes.count)
      console.log(`count: ${changes.count.old} → ${changes.count.val}`);
  });

  store.state.count++;
  store.undo();
</script>
```

### Server / CLI — Headless

```typescript
import { CPXStoreCore } from '@chapeaux/cpx-store/cpx-store-core';
import { historyPlugin } from '@chapeaux/cpx-store/plugins/history';

const store = new CPXStoreCore({ count: 0 }, historyPlugin());

store.computed('doubled', () => (store.state.count as number) * 2);

store.state.count = 5;
console.log(store.state.doubled); // 10

store.undo();
console.log(store.state.count);   // 0
```

`CPXStoreCore` initializes immediately in the constructor. No DOM, no `connectedCallback`, no `customElements.define`. Same plugins, same API.

## Constructor

```typescript
// Browser
new CPXStore(initialState, ...plugins)

// Headless
new CPXStoreCore(initialState, ...plugins)
```

- `initialState` — Plain object with initial values
- `...plugins` — Zero or more `StorePlugin` instances

## Plugins

### Middleware

Runs before each mutation. Can throw to cancel.

```typescript
import { middlewarePlugin } from '@chapeaux/cpx-store/plugins/middleware';

middlewarePlugin([
  // Bare function — runs on every mutation
  (prop, val, oldVal) => console.log(`${prop}: ${oldVal} → ${val}`),

  // Filtered — only runs for matching properties
  { filter: /^editor\./, fn: (prop, val) => validate(val) },
  { filter: 'count', fn: (prop, val) => { if (val < 0) throw new Error('negative'); } },
])
```

Filters accept a string (exact match or prefix), a RegExp, or a predicate function.

### History

Undo/redo with configurable per-property strategies.

```typescript
import { historyPlugin } from '@chapeaux/cpx-store/plugins/history';

historyPlugin({
  maxHistory: 100,             // default 100
  defaultStrategy: 'snapshot', // default
  strategies: {
    content: 'patch',          // store text diffs, not full copies
    cursor: 'none',            // exclude from history entirely
  },
  checkpointInterval: 20,     // full snapshot every 20 patch ops
})
```

| Strategy | Stores | Use Case |
|---|---|---|
| `snapshot` | Full old + new values | Small values (default) |
| `patch` | Text diffs or JSON Patch ops | Large strings, objects |
| `none` | Nothing | Cursor position, scroll offset |

Methods added to the store by this plugin: `undo()`, `redo()`, `historyStrategy(prop, strategy)`, `checkpoint()`, `clearHistory()`.

### Persistence

localStorage save/restore with cross-tab sync via `storage` events.

```typescript
import { persistencePlugin } from '@chapeaux/cpx-store/plugins/persistence';

// Browser — reads key from the persist HTML attribute
persistencePlugin()

// Headless or explicit key
persistencePlugin({ key: 'my-app-state' })
```

```html
<app-store persist="my-app-state"></app-store>
```

The plugin restores state from localStorage on init, writes once per flush (not per mutation), and listens for `storage` events from other tabs. In environments without localStorage, storage operations are silently skipped.

### Collaboration

Pluggable sync transport with operation log and conflict resolution.

```typescript
import { collabPlugin } from '@chapeaux/cpx-store/plugins/collab';
import { BroadcastChannelTransport } from '@chapeaux/cpx-store/transports/broadcast-channel';
import { WebSocketTransport } from '@chapeaux/cpx-store/transports/websocket';

// Same-origin tab sync
collabPlugin({ transport: new BroadcastChannelTransport('my-channel') })

// Multi-user sync with automatic reconnection
collabPlugin({ transport: new WebSocketTransport('wss://example.com/sync') })

// Custom conflict resolution
collabPlugin({
  transport: new WebSocketTransport('wss://example.com/sync'),
  resolver: {
    resolve(local, remote) {
      return remote.timestamp >= local.timestamp ? remote : local;
    }
  }
})
```

Methods added: `getOperationLog()`, `disconnect()`.

## Computed Properties

No dependency array — dependencies are auto-tracked during evaluation.

```typescript
store.computed('total', () => {
  return (store.state.price as number) * (store.state.qty as number);
});

store.state.price = 5;
console.log(store.state.total); // recomputed automatically
```

Conditional dependencies work correctly:

```typescript
store.computed('value', () => {
  return store.state.useA ? store.state.a : store.state.b;
});
// Only tracks state.a when state.useA is true
```

Transitive dependencies chain automatically:

```typescript
store.computed('doubled', () => (store.state.base as number) * 2);
store.computed('quadrupled', () => (store.state.doubled as number) * 2);
```

## Batching and Transactions

Multiple mutations in the same tick are coalesced into one event by default. For explicit control:

```typescript
// Synchronous flush at end of block
store.batch(() => {
  store.state.a = 1;
  store.state.b = 2;
}); // one event

// Rollback on error
store.transaction(() => {
  store.state.balance -= 100;
  if (store.state.balance < 0) throw new Error('insufficient');
}); // state unchanged, no event

// Async with auto-batching
await store.dispatch(async (state) => {
  const data = await fetch('/api');
  state.items = await data.json();
  state.loading = false;
}); // one event after promise resolves
```

## Nested State

Deep object properties are accessible through recursive Proxies:

```typescript
const store = new CPXStoreCore({
  editor: {
    file1: { content: 'hello', dirty: false },
    file2: { content: 'world', dirty: true },
  }
});

store.state.editor.file1.content = 'updated';
// Change tracked as prop: "editor.file1.content"
```

Each nested path gets its own reactive signal, so computed values that read `state.editor.file1.content` are not invalidated when `file2` changes.

## Events

### Browser (`CPXStore`)

```typescript
store.addEventListener('change', (e) => {
  const { changes } = e.detail;
  // changes is an object: { propName: { old, val }, ... }
  for (const [prop, { old, val }] of Object.entries(changes)) {
    console.log(`${prop}: ${old} → ${val}`);
  }
});
```

A global `app-state-update` event is also dispatched on `window` with `{ store: tagName, changes }`.

### Headless (`CPXStoreCore`)

```typescript
const unsub = store.onChange((changes) => {
  // changes is a Map<string, { old, val }>
  for (const [prop, { old, val }] of changes) {
    console.log(`${prop}: ${old} → ${val}`);
  }
});

// Later:
unsub();
```

### Sync

Apply remote state without triggering outbound sync:

```typescript
store.sync({ count: 42, theme: 'dark' });
```

Override `onSyncReceived` for side effects:

```typescript
class MyStore extends CPXStore {
  onSyncReceived(newState, oldState) {
    if (newState.theme !== oldState.theme) {
      document.body.className = newState.theme;
    }
  }
}
```

## SSR Hydration

```typescript
// Server
import { CPXStoreCore } from '@chapeaux/cpx-store/cpx-store-core';

const store = new CPXStoreCore({ user: null, items: [] });
store.state.user = await db.getUser(sessionId);
store.state.items = await db.getItems(store.state.user.id);

const html = `<script>window.__STATE__ = ${JSON.stringify(store.toJSON())}</script>`;
```

```typescript
// Client
import { CPXStore } from '@chapeaux/cpx-store';
import { historyPlugin } from '@chapeaux/cpx-store/plugins/history';

class MyStore extends CPXStore {
  constructor() {
    super(window.__STATE__, historyPlugin());
  }
}
customElements.define('my-store', MyStore);
```

## Working with Large Data Structures

The nested proxy system creates a `ReactiveState` signal and a cached `Proxy` for every path segment accessed. For moderate-cardinality application state — open tabs, selections, theme, layout — this is the right model. For large collections (10K+ node file trees, streaming language server diagnostics, terminal buffers), the per-node overhead becomes the bottleneck.

The recommended pattern: store a **version counter** in the proxied state, and keep the heavy data structure outside the proxy. Computed values and change handlers react to the counter bump, then read from the external structure directly.

```typescript
class IDEStore extends CPXStore {
  fileTree = new FileTree();
  diagnostics = new Map();

  constructor() {
    super(
      {
        fileTreeVersion: 0,
        diagnosticVersion: 0,
        selectedFile: null,
        openTabs: [],
        theme: 'dark',
      },
      historyPlugin({
        strategies: {
          fileTreeVersion: 'none',
          diagnosticVersion: 'none',
        }
      }),
      persistencePlugin()
    );
  }

  // One proxy write per batch of tree changes
  updateFileTree(changes) {
    this.fileTree.applyBatch(changes);
    this.state.fileTreeVersion++;
  }

  // One proxy write per diagnostic update
  setDiagnostics(uri, entries) {
    this.diagnostics.set(uri, entries);
    this.state.diagnosticVersion++;
  }
}
```

Computed values that depend on the version counter re-evaluate when it bumps:

```typescript
store.computed('errorCount', () => {
  store.state.diagnosticVersion; // subscribe to changes
  let count = 0;
  for (const entries of store.diagnostics.values()) {
    count += entries.filter(d => d.severity === 'error').length;
  }
  return count;
});
```

The store manages coordination state (what is selected, what is open, what version are we on). The heavy data lives in purpose-built structures that are optimized for their specific access patterns. Change events tell the UI *that* something changed; the UI reads the external structure to find out *what*.

This mirrors how production applications use Redux or Zustand: you store IDs and metadata in the state tree, not the full dataset. The difference is that cpx-store makes this explicit through the version-counter pattern rather than hiding it behind normalization libraries.

## Project Structure

```
cpx-store/
├── src/
│   ├── cpx-store-core.ts         # Headless core (CPXStoreCoreMixin + CPXStoreCore)
│   ├── cpx-store.ts              # Web Component wrapper (CPXStore)
│   ├── reactivity.ts             # ReactiveState, ReactiveComputed
│   ├── types.ts                  # StorePlugin, SyncTransport, StateOperation
│   ├── plugins/
│   │   ├── middleware.ts          # Filterable middleware
│   │   ├── history.ts            # Undo/redo with strategies
│   │   ├── persistence.ts        # localStorage + cross-tab sync
│   │   └── collab.ts             # Collaboration transport
│   ├── transports/
│   │   ├── broadcast-channel.ts   # BroadcastChannel transport
│   │   └── websocket.ts          # WebSocket transport with reconnection
│   ├── utils/
│   │   ├── nested-proxy.ts       # Recursive Proxy factory
│   │   └── json-patch.ts         # RFC 6902 diff/apply
│   └── stores/
│       └── cpx-scheme-store.ts   # Example store
├── test/
│   ├── cpx-store.spec.ts         # Core browser tests
│   ├── cpx-store-core.test.ts    # Headless Deno tests
│   ├── nested-state.spec.ts      # Nested proxy tests
│   ├── history-strategies.spec.ts # History strategy tests
│   ├── collab.spec.ts            # Collaboration tests
│   └── scheme-store.spec.ts      # Example store tests
├── demo/                         # Demo application
├── deno.json
├── tsconfig.json
└── web-test-runner.config.mjs
```

## Development

```bash
deno install               # Install dependencies
deno task test:browser     # Run browser tests (Chromium + Firefox)
deno test test/cpx-store-core.test.ts  # Run headless tests
deno task test:watch       # Watch mode
deno task build            # Build
deno task serve            # Dev server
```

## Browser Support

- Chrome/Edge 54+
- Firefox 63+
- Safari 10.1+

## License

SEE LICENSE IN [LICENSE](./LICENSE)

## Author

**Luke Dary** — [ldary@redhat.com](mailto:ldary@redhat.com) — [lukedary.com](https://lukedary.com)
