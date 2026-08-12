// Server-side cpx-store, also run under Deno — same class, same API, no DOM.
// Compare against ssr-react.ts: no npm packages needed, no separate
// server-vs-browser build of the state logic, just the plain library import.
import { CPXStoreCore } from "../../cpx-store-core.js";

const ROOT = new URL("../../", import.meta.url);
const PORT = 8789;

// Unlike ssr-react.ts, this page actually hydrates, so the browser needs to
// fetch cpx-store.js and this demo's own client script from the same
// server. That's the entire client-side dependency list — no framework
// runtime, no bundler output, just these two plain files.
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

  // Headless core: initializes immediately, no connectedCallback, no DOM.
  // README.md's "SSR Hydration" section is the basis for this pattern —
  // build state server-side, serialize it, hydrate the same shape client-side.
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
