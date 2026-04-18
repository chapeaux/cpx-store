# CPX Store

> A reactive state management web component with built-in persistence, history tracking, and cross-tab synchronization.

[![License](https://img.shields.io/badge/license-SEE%20LICENSE-blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Web Components](https://img.shields.io/badge/Web%20Components-v1-green)](https://www.webcomponents.org/)

## Features

- 🎯 **Framework-Agnostic** - Works with vanilla JavaScript, React, Vue, or any framework
- 🔄 **Reactive State** - Proxy-based state management with automatic change detection
- 📝 **History Tracking** - Built-in undo/redo functionality
- 💾 **Persistent Storage** - Optional localStorage integration
- 🔗 **Cross-Tab Sync** - Automatic state synchronization across browser tabs
- 🎨 **Middleware Support** - Extensible with custom middleware functions
- 🧪 **Well Tested** - Comprehensive test suite running in real browsers
- 📦 **Zero Dependencies** - Pure Web Components standard

## Installation

```bash
# Using JSR (recommended)
deno add jsr:@chapeaux/cpx-store

# Using npm
npm install @chapeaux/cpx-store
```

> **[View on JSR](https://jsr.io/@chapeaux/cpx-store)** — CPX Store is published to the JavaScript Registry with full TypeScript source, no build step required.

## Quick Start

### Basic Usage

```typescript
import { CPXStore } from '@chapeaux/cpx-store';

// Define your store
class AppStore extends CPXStore {
  constructor() {
    super({ count: 0 });
  }

  increment() {
    this.state.count++;
  }
}

// Register the custom element
customElements.define('app-store', AppStore);
```

```html
<!-- Use in HTML -->
<app-store id="store"></app-store>

<script>
  const store = document.querySelector('#store');

  // Listen to changes
  store.addEventListener('change', (e) => {
    console.log('State changed:', e.detail);
  });

  // Update state
  store.increment();
</script>
```

### With Middleware

```typescript
class CounterStore extends CPXStore {
  constructor() {
    super(
      { count: 0 },
      [
        // Logging middleware
        (prop, value, oldValue) => {
          console.log(`${prop}: ${oldValue} → ${value}`);
        },
        // Validation middleware
        (prop, value) => {
          if (prop === 'count' && value < 0) {
            throw new Error('Count cannot be negative');
          }
        }
      ]
    );
  }
}

customElements.define('counter-store', CounterStore);
```

### With Persistence

```html
<app-store persist="my-app-state"></app-store>
```

```typescript
// State is automatically saved to localStorage
// and restored on page reload
const store = document.querySelector('app-store');
store.state.count = 42; // Automatically persisted
```

### With Undo/Redo

```typescript
const store = document.querySelector('app-store');

store.state.count = 1;
store.state.count = 2;
store.state.count = 3;

store.undo(); // count = 2
store.undo(); // count = 1
store.redo(); // count = 2
```

## API Reference

### Constructor

```typescript
constructor(initialState = {}, middleware = [])
```

**Parameters:**
- `initialState` - Object containing the initial state
- `middleware` - Array of middleware functions `(prop, value, oldValue) => void`

### Properties

- `state` - Reactive proxy to the store's state (available after `connectedCallback`)

### Methods

#### `undo()`
Reverts the state to the previous snapshot in history.

#### `redo()`
Advances the state to the next snapshot in history.

### Events

#### `change`
Fired whenever state is modified.

```typescript
store.addEventListener('change', (event) => {
  const { prop, value } = event.detail;
  console.log(`Property "${prop}" changed to:`, value);
});
```

**Global Event:**
Also dispatches a global `app-state-update` event on `window` for legacy integrations.

## Advanced Usage

### Cross-Tab Synchronization

```typescript
class SyncedStore extends CPXStore {
  constructor() {
    super({ data: 'initial' });

    // Listen for changes from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === this.getAttribute('persist')) {
        this._isSyncing = true;
        Object.assign(this.state, JSON.parse(e.newValue));
        this._isSyncing = false;
      }
    });
  }
}

customElements.define('synced-store', SyncedStore);
```

```html
<synced-store persist="shared-state"></synced-store>
```

### Custom Actions

```typescript
class UserStore extends CPXStore {
  constructor() {
    super({
      name: 'Guest',
      email: '',
      loggedIn: false
    });
  }

  login(name, email) {
    this.state.name = name;
    this.state.email = email;
    this.state.loggedIn = true;
  }

  logout() {
    this.state.name = 'Guest';
    this.state.email = '';
    this.state.loggedIn = false;
  }
}

customElements.define('user-store', UserStore);
```

### Integration with React

```jsx
import { useEffect, useState } from 'react';

function useStore(storeName) {
  const [state, setState] = useState({});

  useEffect(() => {
    const store = document.querySelector(storeName);
    if (!store) return;

    const handleChange = () => setState({ ...store.state });
    store.addEventListener('change', handleChange);
    handleChange(); // Initial sync

    return () => store.removeEventListener('change', handleChange);
  }, [storeName]);

  return state;
}

function Counter() {
  const { count } = useStore('app-store');
  const store = document.querySelector('app-store');

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => store.state.count++}>
        Increment
      </button>
    </div>
  );
}
```

## Examples

Check out the [demo](./demo) folder for complete examples including:

- **Write-Only Components** - Fire-and-forget action buttons
- **Legacy JavaScript** - Integration with plain scripts
- **Lazy Loading** - Selective hydration with IntersectionObserver
- **Theme Switching** - Real-world state management example

## Development

### Setup

```bash
# Install dependencies
deno install

# Run tests
deno task test:browser

# Run tests in watch mode
deno task test:watch

# Build
deno task build

# Serve demo
deno task serve
```

### Running Tests

Tests run in real browsers (Chromium and Firefox) using Web Test Runner:

```bash
deno task test:browser
```

### Project Structure

```
cpx-store/
├── src/
│   ├── cpx-store.ts           # Base store class
│   └── stores/
│       └── cpx-scheme-store.ts # Example store implementation
├── test/
│   ├── cpx-store.spec.ts      # Core functionality tests
│   └── scheme-store.spec.ts   # Example store tests
├── demo/
│   ├── index.html             # Demo page
│   ├── components.js          # Demo components
│   └── stores.js              # Demo stores
├── deno.json                  # Deno configuration
├── tsconfig.json              # TypeScript configuration
└── web-test-runner.config.mjs # Test runner configuration
```

## Browser Support

CPX Store uses standard Web Components APIs and works in all modern browsers:

- ✅ Chrome/Edge 54+
- ✅ Firefox 63+
- ✅ Safari 10.1+
- ✅ Opera 41+

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

SEE LICENSE IN [LICENSE](./LICENSE)

## Author

**Luke Dary** - [ldary@redhat.com](mailto:ldary@redhat.com)
[https://lukedary.com](https://lukedary.com)

## Acknowledgments

- Built with [Web Components](https://www.webcomponents.org/)
- Tested with [@web/test-runner](https://modern-web.dev/docs/test-runner/overview/)
- Powered by [Deno](https://deno.land/)
