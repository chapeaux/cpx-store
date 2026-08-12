// Server-side React, run entirely under Deno (npm:react / npm:react-dom via
// Deno's npm compatibility layer — no Node, no npm install, no bundler).
import React from "npm:react@18";
import { renderToString } from "npm:react-dom@18/server";

const PORT = 8788;

// React has no server-side state story of its own: this is a pure function
// of whatever the request handed it. There's no store, no mutation, no
// subscriber — "state" here is just an argument.
function Counter({ count }: { count: number }) {
  return React.createElement(
    "div",
    { id: "root" },
    React.createElement("p", null, "Count: ", React.createElement("strong", null, String(count))),
    // This button is inert on purpose. Making it work would require
    // "hydration": shipping React + ReactDOM to the browser and re-running
    // this exact component there so it can attach real event handlers.
    // That's the piece this demo is NOT standing up — the point being made
    // is that it's necessary at all, not that it's hard.
    React.createElement("button", { disabled: true, title: "Static SSR output — not hydrated" }, "+1"),
  );
}

Deno.serve({ port: PORT }, (req) => {
  const url = new URL(req.url);
  const count = Number(url.searchParams.get("count") ?? "0");

  const body = renderToString(React.createElement(Counter, { count }));
  const html = `<!DOCTYPE html>
<html>
<body>${body}</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});

console.log(`Server-side React demo at http://localhost:${PORT}/?count=5`);
