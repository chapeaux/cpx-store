# cpx-store Video: Feedback, Script, and Supporting Code

## Context

Luke offered to record a video presentation on `@components/cpx-store` (`/home/ldary/rh/chapeaux/components/cpx-store`) framed as "State management without React" — using cpx-store as a case study for doing reactive app state with native web platform primitives instead of React. He supplied a 9-point outline. The goal here is threefold: give him constructive feedback on that outline before he records, turn it into a concrete recordable script, and produce small supporting code files so the on-camera demos are real, accurate, and runnable — not slideware.

All claims below were verified directly against the repo (README.md, demo/index.html, demo/stores.js, demo/components.js, src/*.ts, package.json, deno.json, test/collab.spec.ts) via two research passes plus direct file reads, including a fresh `wc -l` line count. Where the outline's own framing risks overstating a claim (e.g. "recent" platform changes, "battle-tested" plugins), that's flagged explicitly — this is going in a public video and accuracy protects credibility more than any individual talking point does.

**Mid-review revision:** Luke asked whether the "simple cpx-store equivalent" (originally just a counter) should instead carry multiple state items — a counter, a light/dark theme toggle, and a dynamic alert message updated server-side based on user input. This is a real improvement: it lets one store carry the whole video and demonstrates three state categories every app actually has (transient local state, a user preference, and server-derived state) instead of a thin single-value example. He confirmed: (1) the alert-message round trip should hit a **real tiny local server**, not a simulated delay, and (2) the theme toggle should remain **plain local state**, with `persistencePlugin` demoed separately in its own small isolated example rather than being bolted onto the theme toggle. He also asked that **every demo's backend/runtime be Deno**, avoiding Node entirely on camera except as a point of discussion (e.g. naming npm/npx-based tooling conceptually, never actually invoking it during recording). The plan below reflects both decisions throughout.

## Deliverable A — Constructive feedback on the 9-point outline

**Strong as-is:** the overall arc (historical gap → primitives that closed it → equivalent demo → what's different → batteries-included → provocative question → hard numbers) is complete and doesn't need reordering.

**Fix before recording:**

1. **"Recent web platform changes" (points 2/4) is the riskiest line in the outline.** Custom Elements v1 shipped in Chrome in 2016, cross-browser baseline by 2018 (Firefox 63, Safari 10.1); `Proxy` is ES2015 (~2016 in evergreen browsers). Neither is "recent" in 2026 — call them "changes that happened after React launched in 2013, now universal baseline" instead. This is more accurate *and* a better story: it explains why this pattern wasn't a safe default in 2015 or 2018 either — it only recently became viable with zero polyfills.
2. **Name the 2013 gap precisely or it reads as a strawman.** No Custom Elements v1 (only an abandoned v0/Polymer-era draft), no `Proxy` (ES5 only — `Object.observe` was proposed but Chrome dropped it in 2015 without other browsers shipping it), no native templating. Also be honest that React's real innovation bundle was virtual-DOM diffing + component model + Flux's unidirectional flow — state management was one piece, not the whole story.
3. **State the scope boundary out loud, explicitly, ideally right after point 6.** cpx-store has no rendering layer, no vdom, no diffing, no JSX-equivalent. It solves state, not rendering. Without this sentence, "state management without React" risks being heard as "you don't need React at all." Say something like: *"This isn't a rendering framework — you still own the DOM update path. cpx-store's job stops at 'here's what changed.'"*
4. **Point 7's "no extra libraries" claim needs one honesty caveat.** Of the four collab transports, `BroadcastChannelTransport` is fully tested; `WebSocketTransport` is explicitly not integration-tested (`test/collab.spec.ts:397-400` comments out that suite, noting it needs a real server); `SolidTransport` has zero test coverage anywhere in `/test/`. Demo only `BroadcastChannelTransport` live; mention the other two exist but don't call them "battle-tested."
5. **Don't use `demo/index.html` on camera as-is.** Beyond the two issues already known (references a nonexistent `store.js`; `demo/stores.js` uses a stale `super({...}, [middlewareFn])` array-of-functions constructor signature that doesn't match the current `...plugins` variadic-instances API), the increment/theme buttons are independently broken: `demo/components.js` dispatches `` `${storeAttr}:action` `` (e.g. `"app-store:action"`), but `demo/stores.js` only listens for `"app:action"` on `window` — the names never match. `theme-store` is targeted by two buttons but no such element is ever defined. Recommendation: don't patch this file for the video; use the new purpose-built files in Deliverable C instead.
6. **README's dependency-count claim is measurably off.** `README.md:21` says "~1,040 lines of TypeScript total"; a fresh `find src -name "*.ts" -exec wc -l {} +` gives **1,541 lines**. Worth fixing in the README before or shortly after publishing — a viewer could grep this live.
7. **Missing from the outline: name what's given up, not just gained.** No component/devtools ecosystem, no Redux DevTools-style time-travel UI, no JSX tooling ergonomics (in-template autocomplete, JSX-aware refactors), smaller hiring pool for this exact pattern. Naming trade-offs reads as engineering judgment; only listing advantages reads as marketing — especially coming from the author.
8. **Point 9 framing:** compare "dependency surface of a working app," not "React the library has N dependencies" — `react`/`react-dom` are two packages, full stop. The more interesting number is required *build tooling* (0 vs. transpiler+bundler), not raw dependency count.
9. **Two more precise, honest talking points worth folding into point 6:** (a) `CPXStoreCore` initializes in its constructor, but `CPXStore` (the Custom Element) only initializes in `connectedCallback()` — `.state` is `undefined` until the element is attached to the DOM. This is a real, non-obvious thing for a React dev to learn, and it's more credible to name it than to dodge it. (b) The signals engine (`src/reactivity.ts`) is bespoke hand-rolled code (push-dirty/pull-recompute), not the TC39 Signals proposal — say this plainly so no one assumes standards-track machinery is involved.
10. **Segment 5's demo now intentionally breaks 1:1 parity with segment 3's React counter** (it grows to three state items instead of one). Say this out loud on camera — "we'll start with the same counter as a parity check, then show two more state concerns real apps actually have" — so it doesn't read as a bait-and-switch against the React example.
11. **A follow-up question worth answering explicitly on camera: does removing React for state make React-for-rendering redundant?** No — and this is worth being precise about, because the intuitive answer is wrong in an interesting way. React 18 ships `useSyncExternalStore` specifically as the sanctioned hook for "consume state I don't own, re-render when it changes" — the Redux/Zustand/Jotai-with-React pattern already decouples state ownership from rendering, and it's a first-party-supported split, not a workaround. `02b-react-only.html`'s ReactApp is exactly this: React owns zero state, it only subscribes to cpx-store's `change` event and re-renders. Redundancy shows up on a *different* axis: if you also replace React's component/composition model with Custom Elements (which cpx-store's own architecture nudges toward), then a JSX component tree on top starts competing with the Custom Element tree rather than complementing it — that's a real cost, but it's about component architecture, not state management. Say both halves of this on camera or the "no" will sound unmotivated.
12. **Real gotcha worth naming while demonstrating `useSyncExternalStore`:** its snapshot selector must return a primitive, not `store.state` itself. `store.state` is a Proxy mutated in place, so returning it directly is the same object reference on every call — React's `Object.is` equality check sees no change and the component never re-renders. Select `store.state.count` (a primitive), not `{ ...store.state }` or `store.state`. This isn't a bug in either library — it's the standard "mutable external source vs. immutable snapshot" tension `useSyncExternalStore` was built around, and cpx-store's mutate-in-place model sits on the mutable side of that divide, same as a native `Map` would.
13. **A second follow-up, added for the SSR comparison: Deno can run server-side React (`npm:react`/`npm:react-dom/server`) with zero Node involved** — verified live, `renderToString` works fine under Deno's npm compatibility layer, no `npm install`, no Node process. Say this precisely: the *React library* doesn't require Node, only the *conventional tooling around it* (Next.js, Create React App, most Vite SSR setups) assumes a Node host. Don't let this get simplified into "React needs Node" or "React doesn't need Node" as a blanket claim — both are wrong in different ways.

## Deliverable B — Segment-by-segment script (~12-15 min total, ~130 wpm pacing)

**1. What "state management" means (~60-75s).** Talking head/slide, no code. Define: single source of truth for data that changes over time, predictable mutation, notification to whatever reacts to the change. It's a concern, not a library. Thesis line: "the tools we reach for here are usually chosen based on what the platform *couldn't* do at the time we picked them."

**2. Why React gained ground circa 2013 (~90-120s).** Slide/bullets. Cover the precise 2013 gap (no Custom Elements v1, no `Proxy`, `Object.observe` dead-ended) and the honest framing that React's bundle was diffing + components + Flux, state being one piece. Land: "React solved state *and* rendering *and* componentization because the platform gave it nothing to build on for any of the three."

**3. Simple React example (~60-90s).** Show a plain, fully self-contained React counter — React owns the state, nothing external involved:
```jsx
const Counter = () => {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      <p>Count: <strong>{count}</strong></p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
};
```
A slide/snippet is enough here — it doesn't need its own running file. Narrate `useState`, the closure-based updater, JSX→`createElement`, and that this is the pattern being displaced. This is the direct parity anchor for segment 5's first beat (both are "a number, a button, a click handler").

**4. Platform primitives cpx-store is built on (~90-120s).** Slide + optionally show `README.md:469-473` (Browser Support). Cover Custom Elements v1, `Proxy`, `CustomEvent`, `queueMicrotask`, then say explicitly: "none of these are new in 2026 — what's new is building entirely on them with zero polyfills as a supported baseline (Chrome/Edge 54+, Firefox 63+, Safari 10.1+)." One line on the bespoke signals engine, not TC39 Signals.

**5. Simple cpx-store equivalent, then grow it (~2-2.5 min).** Run `01-simple-example.html` (Deliverable C) live.
   - Beat 1 (parity check, ~30s): show just the counter section — `store.state.count++`, no `useState`/`useEffect`/dependency array, no build step. This is the direct segment-3 equivalent.
   - Beat 2 (~30-45s): reveal the theme toggle — same store, same pattern, just another plain property (`store.state.theme = ...`), driving a CSS class. Call out this is *plain local state*, no plugin involved yet.
   - Beat 3 (~45-60s): reveal the alert-message input — typing a message and clicking "Send to server" calls `store.dispatch(async (state) => { const res = await fetch(...); state.alertMessage = (await res.json()).alertMessage })` against the real local server from Deliverable C. Narrate: this is core `dispatch()` (README `Batching and Transactions`, `README.md:257-263`), not a plugin — one `change` event fires after the promise resolves, no manual loading-state juggling required to keep the UI consistent.
   - Close the segment: "three different kinds of state — transient, preference, server-derived — same `store.state.x = y` mental model for all three."

**6. What's actually different building this way (~2.5-3 min).** Compare segment 3's markup/JSX to segment 5's HTML/DOM, no new code yet. Cover: HTML/DOM templates vs. JSX (no compile step), Custom Element lifecycle vs. component lifecycle (call out the `CPXStore.state` readiness gotcha vs. `CPXStoreCore`'s immediate init, `README.md:84`), push-based DOM-event subscription vs. hook contracts, plain property writes vs. `setState`/reducers, and note that the segment-5 server round trip needed zero `useEffect`/loading-state boilerplate the way a React equivalent would.
   - **State the scope boundary explicitly here**: no vdom, no diffing, no component tree — you still own the DOM update path, same as `demo/index.html`'s own manual `sync()` function (lines 58-70) already does.
   - **New closing beat, three-part live demo (~2-2.5 min): does dropping React for state make React for rendering redundant?** Split into a "proof" half and a "cost" half — they answer different questions and shouldn't be collapsed into one file.
     - *Proof, not just assertion (~45-60s):* Open `02-interop.html` (Deliverable C) — one `<app-store>`, a plain DOM listener, and a React tree via `React.useSyncExternalStore` (React 18's own first-party hook for "consume state I don't own," not a hack), both on one page. Click either button and let both sides update live — this is the single most convincing visual in the video for "these aren't coupled": neither renderer knows the other exists, both stay in sync off one source of truth. Land the answer directly here: no, they aren't coupled; `useSyncExternalStore` is proof React's team already expects this split.
     - *Cost, isolated (~60-90s):* Now open `02a-cpx-only.html` (plain DOM listener, nothing else loaded), then `02b-react-only.html` (same pattern wrapped in React) — deliberately two *separate* files this time, not the combined page, so each one's DevTools Network/Performance panel reflects only its own implementation with no shared script execution or listeners from the other to muddy the numbers. Name the cost precisely: `02b` downloads and parses React + ReactDOM + Babel Standalone (~4.3MB combined, vendored locally) before its first render; `02a` loads none of that. Both pages log a `console.log` interactive timestamp for an easy side-by-side number.
     - Then name where redundancy *does* show up architecturally: if you also replace React's component model with Custom Elements (which this whole video has been doing), a JSX tree on top starts competing with the Custom Element tree instead of complementing it — that's a real cost, but it's about component architecture, not state. Also flag, briefly, the `useSyncExternalStore` snapshot gotcha: the selector returns `store.state.count` (a primitive), not `store.state` itself, because the Proxy mutates in place and would look identical to React's `Object.is` check otherwise.

**7. Server-side rendering: React SSR vs. `CPXStoreCore` (~2-2.5 min).** Both servers run live, both under Deno.
   - Run `ssr-react.ts` (Deliverable C), open/curl `http://localhost:8788/?count=5`. Narrate: `renderToString` under Deno's `npm:` compatibility layer — no Node process, no `npm install`, just `npm:react` / `npm:react-dom/server` specifiers. This is a real, verified data point: React SSR itself doesn't require Node, only most of its conventional tooling (Next.js, CRA, typical Vite SSR setups) assumes a Node host. React has no server-side state model of its own here — `count` is just a request-scoped function argument; nothing persists, nothing mutates, no store exists. Point at the deliberately disabled "+1" button and name precisely what's missing: making it real means shipping React + ReactDOM to the browser and *hydrating* — re-running this exact component there so it can attach real handlers. Don't stand that up live (avoids a brittle on-camera dependency on a CDN fetch); just name it: the same component source has to run in two places, browser and server, which in practice is exactly the seam a bundler exists to paper over.
   - Run `ssr-cpx.ts` (Deliverable C), open `http://localhost:8789/?count=5` in an actual browser — the "+1" button here *does* work, because this one actually hydrates. Narrate: same `CPXStoreCore` class used in segment 4/5's headless examples, no `npm:` specifier, no separate server-vs-browser package — the whole library is already plain ESM the browser loads directly. Point at `window.__STATE__` (`store.toJSON()`, matching README's SSR Hydration section, `README.md:333-357`) and the small `ssr-cpx-client.js` file — that file *is* the entire client bundle.
   - Land the comparison explicitly: "server-side React needs no Node, but still needs to ship a client bundle of React itself to become interactive. Server-side cpx-store needs neither — the same library file plays both roles."

**8. Bells and whistles at zero extra dependency cost (~2-2.5 min).** Scroll `README.md:99-209` live or use a slide.
   - Point at the *already-running* segment-5 demo for `historyPlugin`: the `Undo` button, and specifically that `alertMessage` was configured with strategy `'none'` in `store.js` — "undoing a server round trip doesn't mean anything, so we just opt it out, per property."
   - Show `05-persistence-example.html` (Deliverable C) as its own short, separate beat — a tiny favorite-color store using `persistencePlugin`, reload the page or open a second tab to show localStorage restore + cross-tab sync via the native `storage` event.
   - Name `middlewarePlugin` (filterable interceptors, can throw to cancel) as a slide/snippet, no live demo needed.
   - Name `collabPlugin` + `BroadcastChannelTransport` (demo live if time allows, or narrate) as fully tested; caveat `WebSocketTransport` (no integration test) and `SolidTransport` (no test coverage) honestly rather than showing them as proven.
   - Close: "all in one package, zero extra installs, because it all rests on the segment-4 primitives."

**9. The question (~20-30s).** Plain slide. "Could your application start doing state management without React? Not 'replace React' — just the state layer. Worth trying on a small slice if your rendering is already DOM-light, or you're building headless/server-side/a design-system web-component library."

**10. Quantitative comparison (~60-90s).** Show the table below as a slide, alongside a live `cat package.json` / `cat deno.json` of cpx-store itself (real, on-disk, zero Node invoked). For the React side, show a **static, pre-written example `package.json`** (typed into a text editor or a slide, not actually scaffolded) rather than running `npx create-vite` or any `npm`/`npx` command live — keeps the entire recording session Deno-and-browser-only, per Luke's constraint, while still making the point honestly ("this is what a real Vite+React `package.json` looks like — I'm not running it here, just showing it"). Land: "not 'React has too many dependencies' — it's that a working React app needs a transpiler and bundler as load-bearing infrastructure; here, there's no non-standard syntax to compile, so there isn't." Optionally note the real server processes used in segments 5 and 7 (`server.ts`, `ssr-react.ts`, `ssr-cpx.ts`, all run via `deno run`) were network calls *we* wrote, not build tooling — and every one of them is Deno, not Node, keeping the whole video's runtime story consistent.

| Dimension | cpx-store | Typical React app |
|---|---|---|
| Runtime npm dependencies | 0 (`package.json` has no `"dependencies"` field; only 4 devDependencies, all test/build tooling) | 2 minimum: `react`, `react-dom` |
| Extra state library once state grows | 0 — computed/undo/dispatch are core | Often 1+: Redux Toolkit, Zustand, Jotai, TanStack Query |
| Required transpiler | None | Babel or esbuild/SWC (JSX) |
| Required bundler | None — native ESM via `<script type="module">` | Vite/webpack, or a meta-framework wrapping one |
| Framework-specific lint tooling | None beyond generic JS/TS | `eslint-plugin-react`, `eslint-plugin-react-hooks` |
| Library source size | 1,541 lines TS (verified `wc -l`; README currently says ~1,040 — fix pending) | react + react-dom + any added state lib |
| Runs unmodified headless (Node/Deno/Bun/CF Workers) | Yes (`CPXStoreCore`) | No — reconciler targets a host environment |

## Deliverable C — Supporting code

New files under `demo/video/` (kept separate from the existing, partially-broken `demo/` assets so nothing needs fixing first).

**`demo/video/server.ts`** — real, tiny, dependency-free Deno server for the alert-message round trip (Deno-only runtime, no Node/npm involved anywhere in this or any other demo file):
```ts
const PORT = 8787;

Deno.serve({ port: PORT }, async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers });

  const { message } = await req.json();
  const alertMessage = `Server processed "${message}" at ${new Date().toISOString()}`;

  return new Response(JSON.stringify({ alertMessage }), { headers });
});

console.log(`Alert server running at http://localhost:${PORT}`);
```
Run with `deno run --allow-net demo/video/server.ts` before recording segment 5/7. CORS is wide open (`*`) since this is a throwaway local demo server, not shipped code.

**`demo/video/store.js`** — the one store used throughout segments 5-7:
```js
import { CPXStore } from '../../cpx-store.js';
import { historyPlugin } from '../../plugins/history.js';

class AppStore extends CPXStore {
  constructor() {
    super(
      { count: 0, theme: 'light', alertMessage: '' },
      historyPlugin({
        strategies: { alertMessage: 'none' }, // server-derived; undoing it isn't meaningful
      }),
    );
  }
}
customElements.define('app-store', AppStore);
```

**`demo/video/01-simple-example.html`** — the main segment 5/6/7 demo (counter + doubled + undo, theme toggle, alert-message server round trip):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>cpx-store — state without React</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 4rem auto; transition: background 0.2s, color 0.2s; }
    body.dark { background: #1a1a1a; color: #eee; }
    button, input { font-size: 1rem; padding: 0.5rem 1rem; }
    section { margin-bottom: 2rem; }
  </style>
</head>
<body>
  <app-store id="store"></app-store>

  <section>
    <h3>Local state — counter</h3>
    <p>Count: <strong id="count">0</strong> (doubled: <strong id="doubled">0</strong>)</p>
    <button id="inc">+1</button>
    <button id="undo">Undo</button>
  </section>

  <section>
    <h3>User preference — theme</h3>
    <p>Theme: <strong id="theme">light</strong></p>
    <button id="toggle-theme">Toggle theme</button>
  </section>

  <section>
    <h3>Server-derived state — alert message</h3>
    <input id="message-input" placeholder="Type a message" />
    <button id="send">Send to server</button>
    <p id="alert"></p>
  </section>

  <script type="module" src="./store.js"></script>
  <script type="module">
    await customElements.whenDefined('app-store');
    const store = document.querySelector('#store');

    store.computed('doubled', () => store.state.count * 2);

    const render = () => {
      document.querySelector('#count').textContent = store.state.count;
      document.querySelector('#doubled').textContent = store.state.doubled;
      document.querySelector('#theme').textContent = store.state.theme;
      document.body.classList.toggle('dark', store.state.theme === 'dark');
      document.querySelector('#alert').textContent = store.state.alertMessage;
    };
    store.addEventListener('change', render);
    render();

    document.querySelector('#inc').onclick = () => store.state.count++;
    document.querySelector('#undo').onclick = () => store.undo();
    document.querySelector('#toggle-theme').onclick = () => {
      store.state.theme = store.state.theme === 'light' ? 'dark' : 'light';
    };

    document.querySelector('#send').onclick = () => {
      const message = document.querySelector('#message-input').value;
      store.dispatch(async (state) => {
        const res = await fetch('http://localhost:8787/api/alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        state.alertMessage = (await res.json()).alertMessage;
      });
    };
  </script>
</body>
</html>
```
Note: `store.dispatch` posts to `/api/alert` for narration purposes — `server.ts` above accepts any path/POST, so this works as written; if a stricter route match is wanted, add a one-line `if (new URL(req.url).pathname !== "/api/alert") return new Response("Not Found", { status: 404, headers })` to `server.ts`.

**`demo/video/02-interop.html`** — the "proof" half of segment 6's closing beat: one `<app-store>`, a plain DOM listener, and a React tree via `React.useSyncExternalStore`, both reacting to the same `change` event on one page. Click either button, watch both sides update — this is deliberately kept as a combined page (unlike `02a`/`02b` below) because the whole point here is showing two independent renderers staying in sync off one source of truth; splitting it would remove the exact visual that makes "not coupled" concrete instead of asserted:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>cpx-store + React — same store, two renderers</title>
  <script src="./vendor/react.development.js"></script>
  <script src="./vendor/react-dom.development.js"></script>
  <script src="./vendor/babel.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; display: flex; gap: 2rem; }
    section { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; }
    h2 { margin-top: 0; font-size: 1rem; text-transform: uppercase; color: #6366f1; }
    button { font-size: 1rem; padding: 0.5rem 1rem; cursor: pointer; }
  </style>
</head>
<body>

  <app-store id="store"></app-store>

  <section>
    <h2>cpx-store</h2>
    <p>Count: <strong id="cpx-count">0</strong></p>
    <button id="cpx-inc">Increment from cpx-store</button>
  </section>

  <section>
    <h2>React</h2>
    <div id="react-root"></div>
  </section>

  <script type="module" src="./store.js"></script>

  <script type="module">
    await customElements.whenDefined('app-store');
    const store = document.querySelector('#store');
    const render = () => document.querySelector('#cpx-count').textContent = store.state.count;
    store.addEventListener('change', render);
    render();
    document.querySelector('#cpx-inc').onclick = () => store.state.count++;
  </script>

  <script type="text/babel">
    const ReactApp = () => {
      const count = React.useSyncExternalStore(
        (onStoreChange) => {
          const store = document.querySelector('app-store');
          store.addEventListener('change', onStoreChange);
          return () => store.removeEventListener('change', onStoreChange);
        },
        () => document.querySelector('app-store').state.count,
      );

      return (
        <div>
          <p>React state: <strong>{count}</strong></p>
          <button onClick={() => document.querySelector('app-store').state.count++}>
            Increment from React
          </button>
        </div>
      );
    };

    customElements.whenDefined('app-store').then(() => {
      const root = ReactDOM.createRoot(document.getElementById('react-root'));
      root.render(<ReactApp />);
    });
  </script>
</body>
</html>
```
Verified: loads at 200, both `#cpx-count` and `#react-root` present, `useSyncExternalStore` used (not `useState`/`useEffect`), vendor scripts resolve from this file's location too.

**`demo/video/02a-cpx-only.html`** and **`demo/video/02b-react-only.html`** — the "cost" half of the same beat, split into two separate files on purpose (unlike `02-interop.html` above) so performance can be judged independently per implementation without one page's script execution/listeners affecting the other's numbers:

`02a-cpx-only.html` — the baseline, no React/ReactDOM/Babel loaded at all:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>cpx-store only — performance baseline</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 4rem auto; }
    button { font-size: 1rem; padding: 0.5rem 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <app-store id="store"></app-store>

  <p>Count: <strong id="count">0</strong></p>
  <button id="inc">Increment from cpx-store</button>

  <script type="module" src="./store.js"></script>
  <script type="module">
    await customElements.whenDefined('app-store');
    const store = document.querySelector('#store');

    const render = () => document.querySelector('#count').textContent = store.state.count;
    store.addEventListener('change', render);
    render();

    document.querySelector('#inc').onclick = () => store.state.count++;

    console.log(`cpx-store interactive at ${performance.now().toFixed(1)}ms`);
  </script>
</body>
</html>
```

`02b-react-only.html` — the same underlying pattern, wrapped in React, with nothing else on the page:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>React only — performance comparison</title>
  <script src="./vendor/react.development.js"></script>
  <script src="./vendor/react-dom.development.js"></script>
  <script src="./vendor/babel.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 4rem auto; }
    button { font-size: 1rem; padding: 0.5rem 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <app-store id="store"></app-store>

  <div id="react-root"></div>

  <script type="module" src="./store.js"></script>

  <script type="text/babel">
    const ReactApp = () => {
      const count = React.useSyncExternalStore(
        (onStoreChange) => {
          const store = document.querySelector('app-store');
          store.addEventListener('change', onStoreChange);
          return () => store.removeEventListener('change', onStoreChange);
        },
        () => document.querySelector('app-store').state.count,
      );

      return (
        <div>
          <p>React state: <strong>{count}</strong></p>
          <button onClick={() => document.querySelector('app-store').state.count++}>
            Increment from React
          </button>
        </div>
      );
    };

    customElements.whenDefined('app-store').then(() => {
      const root = ReactDOM.createRoot(document.getElementById('react-root'));
      root.render(<ReactApp />);
      console.log(`React interactive at ${performance.now().toFixed(1)}ms`);
    });
  </script>
</body>
</html>
```
Both use `React.useSyncExternalStore` (not `useState`/`useEffect`) with the snapshot selector returning the primitive `store.state.count`, not the Proxy itself (see feedback point 12). Each page has its own independent `<app-store>` instance starting at `count: 0` — there's no shared-store visual here, that's `02-interop.html`'s job above. This pair answers "what does each cost," not "do they stay in sync."

React, ReactDOM, and Babel Standalone are **vendored locally** in `demo/video/vendor/` (`react.development.js`, `react-dom.development.js`, `babel.min.js` — pinned at react@18.3.1, react-dom@18.3.1, @babel/standalone@7.29.8, fetched once from unpkg) rather than loaded via `<script src="https://unpkg.com/...">` at recording time — eliminates the one remaining CDN dependency in the whole demo set. `demo/video/serve.ts` serves these the same way it serves everything else. Verified: `http://localhost:8000/demo/video/vendor/{react.development.js,react-dom.development.js,babel.min.js}` all return 200 with the correct JS content type through the existing static server.

**`demo/video/05-persistence-example.html`** — separate, isolated `persistencePlugin` demo (segment 7):
```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>cpx-store — persistence</title></head>
<body>
  <favorite-store id="store"></favorite-store>
  <p>Favorite color: <strong id="color">none</strong></p>
  <input id="color-input" placeholder="e.g. teal" />
  <button id="save">Save</button>
  <p><em>Reload this page, or open it in a second tab, to see the value persist and sync.</em></p>

  <script type="module">
    import { CPXStore } from '../../cpx-store.js';
    import { persistencePlugin } from '../../plugins/persistence.js';

    class FavoriteStore extends CPXStore {
      constructor() {
        super({ favoriteColor: 'none' }, persistencePlugin({ key: 'video-demo-favorite' }));
      }
    }
    customElements.define('favorite-store', FavoriteStore);

    await customElements.whenDefined('favorite-store');
    const store = document.querySelector('#store');
    const render = () => document.querySelector('#color').textContent = store.state.favoriteColor;
    store.addEventListener('change', render);
    render();

    document.querySelector('#save').onclick = () => {
      store.state.favoriteColor = document.querySelector('#color-input').value;
    };
  </script>
</body>
</html>
```

**`demo/video/serve.ts`** — Deno-only static file server for the demo pages (replaces any need for `python3 -m http.server` or the library's own `deno task serve`, keeping every part of this video on Deno). Serves the whole package root, not just `demo/video/`, so relative imports like `../../cpx-store.js` resolve the same way they do when a file is opened directly:
```ts
const ROOT = new URL("../../", import.meta.url);
const PORT = 8000;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".ts": "text/typescript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname === "/" ? "/demo/video/01-simple-example.html" : url.pathname;

  if (pathname.includes("..")) return new Response("Bad Request", { status: 400 });

  try {
    const fileUrl = new URL("." + pathname, ROOT);
    const file = await Deno.readFile(fileUrl);
    const ext = pathname.slice(pathname.lastIndexOf("."));
    return new Response(file, {
      headers: { "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
});

console.log(`Demo files served at http://localhost:${PORT}/`);
```
Run with `deno run --allow-read --allow-net demo/video/serve.ts`, then open `http://localhost:8000/demo/video/01-simple-example.html` (and the other demo pages under the same origin). Verified: serves `.html` pages, serves `cpx-store.js`/`plugins/*.js` from the package root, and returns 400 on `..` path traversal attempts.

**`demo/video/ssr-react.ts`** — server-side React, run entirely under Deno via `npm:react`/`npm:react-dom/server` (no Node, no `npm install`, no bundler). Verified live with `curl` — `renderToString` executes correctly under Deno's npm compatibility layer:
```ts
import React from "npm:react@18";
import { renderToString } from "npm:react-dom@18/server";

const PORT = 8788;

function Counter({ count }: { count: number }) {
  return React.createElement(
    "div",
    { id: "root" },
    React.createElement("p", null, "Count: ", React.createElement("strong", null, String(count))),
    // Inert on purpose — making this work requires hydration (see segment 7).
    React.createElement("button", { disabled: true, title: "Static SSR output — not hydrated" }, "+1"),
  );
}

Deno.serve({ port: PORT }, (req) => {
  const url = new URL(req.url);
  const count = Number(url.searchParams.get("count") ?? "0");
  const body = renderToString(React.createElement(Counter, { count }));
  const html = `<!DOCTYPE html><html><body>${body}</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});

console.log(`Server-side React demo at http://localhost:${PORT}/?count=5`);
```
Run with `deno run --allow-net --allow-read --allow-env demo/video/ssr-react.ts`.

**`demo/video/ssr-cpx.ts`** — the `CPXStoreCore` equivalent. Also serves its own two static dependencies (`cpx-store.js`, `ssr-cpx-client.js`) so the page actually hydrates when opened in a real browser — this was caught and fixed during verification (an earlier version returned the same rendered-count HTML for every path, so the browser's request for the client script silently got HTML back instead and hydration never fired):
```ts
import { CPXStoreCore } from "../../cpx-store-core.js";

const ROOT = new URL("../../", import.meta.url);
const PORT = 8789;

const STATIC_FILES: Record<string, string> = {
  "/cpx-store.js": "text/javascript; charset=utf-8",
  "/demo/video/ssr-cpx-client.js": "text/javascript; charset=utf-8",
};

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  const contentType = STATIC_FILES[url.pathname];
  if (contentType) {
    const file = await Deno.readFile(new URL("." + url.pathname, ROOT));
    return new Response(file, { headers: { "Content-Type": contentType } });
  }

  const count = Number(url.searchParams.get("count") ?? "0");
  const store = new CPXStoreCore({ count });

  const html = `<!DOCTYPE html>
<html>
<body>
  <app-store id="store"></app-store>
  <p>Count: <strong id="count">${store.state.count}</strong></p>
  <button id="inc">+1</button>
  <script>window.__STATE__ = ${JSON.stringify(store.toJSON())};</script>
  <script type="module" src="/demo/video/ssr-cpx-client.js"></script>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});

console.log(`Server-side cpx-store demo at http://localhost:${PORT}/?count=5`);
```
Run with `deno run --allow-net --allow-read demo/video/ssr-cpx.ts`.

**`demo/video/ssr-cpx-client.js`** — the hydration script, and the entirety of the client bundle:
```js
import { CPXStore } from '../../cpx-store.js';

class AppStore extends CPXStore {
  constructor() {
    super(window.__STATE__);
  }
}
customElements.define('app-store', AppStore);

await customElements.whenDefined('app-store');
const store = document.querySelector('#store');

store.addEventListener('change', () => {
  document.querySelector('#count').textContent = store.state.count;
});

document.querySelector('#inc').onclick = () => store.state.count++;
```

All HTML files under `demo/video/` (the ones without their own server — `01-simple-example.html`, `02-interop.html`, `02a-cpx-only.html`, `02b-react-only.html`, `05-persistence-example.html`) should be opened through `demo/video/serve.ts`, e.g. `http://localhost:8000/demo/video/01-simple-example.html` — fetch from that origin to `http://localhost:8787` (the alert server) works fine since `server.ts` sets `Access-Control-Allow-Origin: *`. `ssr-react.ts` and `ssr-cpx.ts` are each their own server and don't need `serve.ts` running. Keep DevTools Network tab visible during segments 5, 6, 7, and 10 to visually prove the only network activity is the explicit `fetch()`/hydration calls (or, for segment 6's `02a`/`02b` comparison, exactly the vendor scripts each page chooses to load), not bundler chunk requests.

## Verification

Already run once during planning; repeat before the actual recording session in case the library source has changed:

- Start `deno run --allow-read --allow-net demo/video/serve.ts` — confirmed serves `.html` pages, `cpx-store.js`, and `plugins/*.js` from the package root (200s), and returns 400 on `..` path-traversal attempts.
- Start `deno run --allow-net demo/video/server.ts` — confirmed console logs `Alert server running at http://localhost:8787`; `curl -X POST http://localhost:8787/api/alert -d '{"message":"hello"}'` returned a real, server-timestamped JSON response.
- Open `demo/video/01-simple-example.html` (via `serve.ts`) and confirm: counter +1/Undo work; theme toggle flips the page background and `#theme` label; typing a message and clicking "Send to server" populates `#alert` with a string containing the typed message and a server-generated timestamp.
- Open `demo/video/02-interop.html` and confirm it loads (200), both `#cpx-count` and `#react-root` are present, and clicking either button updates both sides (proves the shared-store interop claim live).
- Open `demo/video/02a-cpx-only.html` and confirm the counter increments and the console logs a `cpx-store interactive at ...ms` line with no React/ReactDOM/Babel requests in the Network panel.
- Open `demo/video/02b-react-only.html` and confirm the counter increments and the console logs a `React interactive at ...ms` line; confirmed the vendored `demo/video/vendor/{react.development.js,react-dom.development.js,babel.min.js}` load with 200s and correct content type through `serve.ts` from all three `02*` pages, with no network requests to unpkg or any other CDN.
- Open `demo/video/05-persistence-example.html`, set a favorite color, reload the page, and confirm the value survives; open a second tab and confirm a save in one tab updates the other live.
- Start `deno run --allow-net --allow-read --allow-env demo/video/ssr-react.ts` — confirmed `curl http://localhost:8788/?count=5` returns HTML with `Count: 5` and a disabled `+1` button, no Node process involved (only `npm:react`/`npm:react-dom` fetched once via Deno's npm compat layer).
- Start `deno run --allow-net --allow-read demo/video/ssr-cpx.ts` — confirmed `curl http://localhost:8789/?count=5` returns HTML with `window.__STATE__ = {"count":5}`; confirmed (after the static-file-serving fix) that `/demo/video/ssr-cpx-client.js` and `/cpx-store.js` both return 200 with the correct JS content type from the *same* server, so opening this URL in a real browser actually hydrates and the `+1` button works.
- Diff the code in all new files against the README snippets cited above to confirm no API drift before recording.
- Re-run `find src -name "*.ts" -exec wc -l {} +` if the source changes before publishing, to keep the segment-10 table's line count accurate.
